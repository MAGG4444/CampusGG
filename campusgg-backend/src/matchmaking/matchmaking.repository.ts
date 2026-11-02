/**
 * @file matchmaking.repository.ts
 * @description PostgreSQL source of truth for matchmaking state.
 *
 * The repository owns every queue mutation and the per-tick transaction:
 *   - enqueue is one transaction with a row lock and a unique user index
 *   - dequeue only removes queued rows
 *   - status polls refresh the heartbeat
 *   - a tick takes a PostgreSQL advisory lock, removes stale rows, loads the
 *     active queue, plans groups, creates lobbies, and marks rows matched
 *
 * Lobby creation is delegated to a callback so persistence and lobby state
 * commit or roll back together.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';

import {
  MatchmakingEntry,
  MatchmakingStatus,
} from './entities/matchmaking-entry.entity.js';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
  DEFAULT_MATCH_RESULT_TTL_MS,
  readPositiveInteger,
} from './matchmaking.config.js';
import type { MatchGroup } from './schemas/match-group.schema.js';
import type { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema.js';

/** Advisory-lock key shared by every API instance. */
export const MATCHMAKING_TICK_LOCK_KEY = 'campusgg:matchmaking:tick:v1';

export enum EnqueueOutcome {
  QUEUED = 'queued',
  ALREADY_QUEUED = 'already-queued',
  PENDING_MATCH = 'pending-match',
}

export interface MatchmakingStatusResult {
  readonly matched: boolean;
  readonly queued: boolean;
  readonly lobbyId?: string;
  readonly game?: string;
  readonly enqueuedAt?: string;
}

export interface PersistedMatchmakingEntry {
  readonly entryId: string;
  readonly player: PlayerMatchmakingInput;
  readonly enqueuedAt: Date;
}

export interface MatchmakingTickMatch {
  readonly group: MatchGroup;
  readonly lobbyId: string;
}

export interface MatchmakingTickResult {
  /** False when another instance already holds the tick advisory lock. */
  readonly processed: boolean;
  readonly matches: ReadonlyArray<MatchmakingTickMatch>;
  readonly loadedEntries: number;
}

export type MatchmakingPlanner = (
  entries: ReadonlyArray<PersistedMatchmakingEntry>,
  now: number,
) => MatchGroup[];

export type MatchmakingMatchHandler = (
  group: MatchGroup,
  manager: EntityManager,
) => Promise<string>;

/**
 * Raised when a batch row disappeared (dequeue, stale cleanup, or another
 * instance) between planning and the mark-matched update. The whole tick
 * transaction rolls back, so an under-filled lobby is never committed.
 */
export class MatchmakingConcurrencyError extends Error {
  constructor(
    readonly groupId: string,
    readonly expectedPlayers: number,
    readonly updatedPlayers: number,
  ) {
    super(
      `Match ${groupId} expected ${expectedPlayers} queued rows but updated ${updatedPlayers}.`,
    );
    this.name = 'MatchmakingConcurrencyError';
  }
}

@Injectable()
export class MatchmakingRepository {
  private readonly heartbeatTimeoutMs: number;
  private readonly matchResultTtlMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.heartbeatTimeoutMs = readPositiveInteger(
      configService.get('MATCHMAKING_HEARTBEAT_TIMEOUT_MS'),
      DEFAULT_HEARTBEAT_TIMEOUT_MS,
    );
    this.matchResultTtlMs = readPositiveInteger(
      configService.get('MATCHMAKING_RESULT_TTL_MS'),
      DEFAULT_MATCH_RESULT_TTL_MS,
    );
    this.batchSize = readPositiveInteger(
      configService.get('MATCHMAKING_BATCH_SIZE'),
      DEFAULT_BATCH_SIZE,
    );
  }

  // ── Enqueue / dequeue ───────────────────────────────────────────────────

  /**
   * Atomically adds a player to the queue.
   *
   * A row lock serialises concurrent enqueue attempts for the same user.
   * If no row exists yet, the unique `user_id` index is the final guard.
   */
  async enqueue(player: PlayerMatchmakingInput): Promise<EnqueueOutcome> {
    const now = new Date();

    try {
      return await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(MatchmakingEntry, {
          where: { userId: player.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (existing) {
          if (existing.status === MatchmakingStatus.QUEUED) {
            return EnqueueOutcome.ALREADY_QUEUED;
          }

          if (hasActiveMatch(existing, now)) {
            return EnqueueOutcome.PENDING_MATCH;
          }

          // Expired result (or a lobby that no longer exists): replace it.
          await manager.delete(MatchmakingEntry, { id: existing.id });
        }

        const entry = manager.create(MatchmakingEntry, {
          userId: player.userId,
          game: player.game,
          status: MatchmakingStatus.QUEUED,
          payload: player,
          enqueuedAt: now,
          heartbeatAt: now,
        });

        await manager.save(MatchmakingEntry, entry);

        return EnqueueOutcome.QUEUED;
      });
    } catch (error) {
      if (!isUniqueViolation(error, 'UQ_matchmaking_entries_user')) {
        throw error;
      }

      // Another instance won the insert race. Report the state it created.
      const existing = await this.dataSource
        .getRepository(MatchmakingEntry)
        .findOne({ where: { userId: player.userId } });

      if (existing?.status === MatchmakingStatus.MATCHED) {
        return hasActiveMatch(existing, now)
          ? EnqueueOutcome.PENDING_MATCH
          : EnqueueOutcome.ALREADY_QUEUED;
      }

      return EnqueueOutcome.ALREADY_QUEUED;
    }
  }

  /** Removes a queued player. Matched results are left untouched. */
  async dequeue(userId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(MatchmakingEntry)
      .delete({ userId, status: MatchmakingStatus.QUEUED });

    return (result.affected ?? 0) > 0;
  }

  // ── Status polling ──────────────────────────────────────────────────────

  /**
   * Returns the active match result or queue state and refreshes the
   * heartbeat. A stale queued entry is removed on read, mirroring the tick's
   * cleanup pass.
   */
  async getMatchStatus(userId: string): Promise<MatchmakingStatusResult> {
    const now = new Date();

    return this.dataSource.transaction(async (manager) => {
      const entry = await manager.findOne(MatchmakingEntry, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!entry) {
        return { matched: false, queued: false };
      }

      if (entry.status === MatchmakingStatus.MATCHED) {
        if (hasActiveMatch(entry, now)) {
          return {
            matched: true,
            queued: false,
            lobbyId: entry.lobbyId!,
            game: entry.game,
          };
        }

        await manager.delete(MatchmakingEntry, { id: entry.id });
        return { matched: false, queued: false };
      }

      if (
        entry.heartbeatAt.getTime() <
        now.getTime() - this.heartbeatTimeoutMs
      ) {
        await manager.delete(MatchmakingEntry, { id: entry.id });
        return { matched: false, queued: false };
      }

      await manager.update(
        MatchmakingEntry,
        { id: entry.id },
        { heartbeatAt: now },
      );

      return {
        matched: false,
        queued: true,
        game: entry.game,
        enqueuedAt: entry.enqueuedAt.toISOString(),
      };
    });
  }

  // ── Tick transaction ────────────────────────────────────────────────────

  /**
   * Runs one complete matchmaking tick in a single transaction.
   *
   * The advisory lock prevents two instances from processing the same queue
   * concurrently. `cleanupExpired` runs before the batch load and the load
   * also filters stale heartbeats, so a stale row can never enter planning.
   */
  async runTick(
    planner: MatchmakingPlanner,
    onMatchFound: MatchmakingMatchHandler,
    now = Date.now(),
  ): Promise<MatchmakingTickResult> {
    return this.dataSource.transaction(async (manager) => {
      const lockRows = await manager.query<Array<{ locked: boolean }>>(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',
        [MATCHMAKING_TICK_LOCK_KEY],
      );

      if (!lockRows[0]?.locked) {
        return {
          processed: false,
          matches: [],
          loadedEntries: 0,
        };
      }

      await this.cleanupExpired(manager, now);

      const entries = await this.loadQueuedBatch(manager, now);
      const plannedGroups = planner(
        entries.map((entry) => ({
          entryId: entry.id,
          player: entry.payload,
          enqueuedAt: entry.enqueuedAt,
        })),
        now,
      );

      const matches: MatchmakingTickMatch[] = [];

      for (const group of plannedGroups) {
        const lobbyId = await onMatchFound(group, manager);
        await this.markMatched(manager, group, lobbyId, now);
        matches.push({ group, lobbyId });
      }

      return {
        processed: true,
        matches,
        loadedEntries: entries.length,
      };
    });
  }

  /**
   * Deletes stale queued rows and expired match results.
   *
   * Must run inside the tick transaction before the queue is loaded.
   */
  async cleanupExpired(
    manager: EntityManager,
    now = Date.now(),
  ): Promise<{ queuedRemoved: number; matchedRemoved: number }> {
    const nowDate = new Date(now);
    const staleBefore = new Date(now - this.heartbeatTimeoutMs);

    const queuedResult = await manager
      .createQueryBuilder()
      .delete()
      .from(MatchmakingEntry)
      .where('status = :status', { status: MatchmakingStatus.QUEUED })
      .andWhere('heartbeat_at < :staleBefore', { staleBefore })
      .execute();

    const matchedResult = await manager
      .createQueryBuilder()
      .delete()
      .from(MatchmakingEntry)
      .where('status = :status', { status: MatchmakingStatus.MATCHED })
      .andWhere('(match_expires_at IS NULL OR match_expires_at <= :now)', {
        now: nowDate,
      })
      .execute();

    return {
      queuedRemoved: queuedResult.affected ?? 0,
      matchedRemoved: matchedResult.affected ?? 0,
    };
  }

  /**
   * Loads active queued rows ordered by enqueue time. The heartbeat filter
   * is a second line of defence after `cleanupExpired`.
   */
  async loadQueuedBatch(
    manager: EntityManager,
    now = Date.now(),
  ): Promise<MatchmakingEntry[]> {
    const staleBefore = new Date(now - this.heartbeatTimeoutMs);

    return manager
      .createQueryBuilder(MatchmakingEntry, 'entry')
      .where('entry.status = :status', { status: MatchmakingStatus.QUEUED })
      .andWhere('entry.heartbeatAt >= :staleBefore', { staleBefore })
      .orderBy('entry.enqueuedAt', 'ASC')
      .addOrderBy('entry.id', 'ASC')
      .limit(this.batchSize)
      .getMany();
  }

  /**
   * Commits the planned group to `matched` state.
   *
   * The affected-row count is authoritative: if a player dequeued, went
   * stale, or otherwise vanished between load and update, the tick throws and
   * the lobby creation is rolled back with it.
   */
  private async markMatched(
    manager: EntityManager,
    group: MatchGroup,
    lobbyId: string,
    now: number,
  ): Promise<void> {
    const userIds = [...group.userIds];
    const nowDate = new Date(now);
    const staleBefore = new Date(now - this.heartbeatTimeoutMs);

    const result = await manager
      .createQueryBuilder()
      .update(MatchmakingEntry)
      .set({
        status: MatchmakingStatus.MATCHED,
        matchedAt: nowDate,
        matchExpiresAt: new Date(now + this.matchResultTtlMs),
        lobbyId,
        groupId: group.groupId,
        score: group.score,
        heartbeatAt: nowDate,
      })
      .where('user_id IN (:...userIds)', { userIds })
      .andWhere('status = :status', { status: MatchmakingStatus.QUEUED })
      .andWhere('heartbeat_at >= :staleBefore', { staleBefore })
      .execute();

    const updated = result.affected ?? 0;

    if (updated !== userIds.length) {
      throw new MatchmakingConcurrencyError(
        group.groupId,
        userIds.length,
        updated,
      );
    }
  }

  // ── Observability ───────────────────────────────────────────────────────

  async getQueueSnapshot(): Promise<Partial<Record<string, number>>> {
    const staleBefore = new Date(Date.now() - this.heartbeatTimeoutMs);

    const rows = await this.dataSource
      .getRepository(MatchmakingEntry)
      .createQueryBuilder('entry')
      .select('entry.game', 'game')
      .addSelect('COUNT(*)', 'count')
      .where('entry.status = :status', { status: MatchmakingStatus.QUEUED })
      .andWhere('entry.heartbeatAt >= :staleBefore', { staleBefore })
      .groupBy('entry.game')
      .getRawMany<{ game: string; count: string }>();

    return rows.reduce<Partial<Record<string, number>>>((snapshot, row) => {
      snapshot[row.game] = Number(row.count);
      return snapshot;
    }, {});
  }

  async getTotalQueueSize(): Promise<number> {
    const staleBefore = new Date(Date.now() - this.heartbeatTimeoutMs);

    return this.dataSource
      .getRepository(MatchmakingEntry)
      .createQueryBuilder('entry')
      .where('entry.status = :status', { status: MatchmakingStatus.QUEUED })
      .andWhere('entry.heartbeatAt >= :staleBefore', { staleBefore })
      .getCount();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hasActiveMatch(entry: MatchmakingEntry, now: Date): boolean {
  return (
    entry.status === MatchmakingStatus.MATCHED &&
    entry.lobbyId !== null &&
    entry.matchExpiresAt !== null &&
    entry.matchExpiresAt.getTime() > now.getTime()
  );
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: string;
    constraint?: string;
    driverError?: { code?: string; constraint?: string };
  };

  const code = candidate.code ?? candidate.driverError?.code;
  const name = candidate.constraint ?? candidate.driverError?.constraint;

  return code === '23505' && (name === undefined || name === constraint);
}
