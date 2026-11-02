/**
 * @file matchmaking.service.ts
 * @description Matchmaking orchestration on top of the PostgreSQL queue.
 *
 * The service owns the engine (pure group planning) and the lobby handoff.
 * All queue state, heartbeats, match results, and the tick transaction live
 * in MatchmakingRepository, so two API instances can share the same queue
 * without an in-memory replica.
 */

import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';

import type { MatchGroup } from './schemas/match-group.schema.js';
import type { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema.js';
import { MatchmakingEngine } from './engine/matchmaking-engine.js';
import { getScoringStrategy } from './engine/strategy-registry.js';
import {
  DEFAULT_SEARCH_WINDOW,
  DEFAULT_TICK_INTERVAL_MS,
  readPositiveInteger,
} from './matchmaking.config.js';
import {
  EnqueueOutcome,
  MatchmakingRepository,
  type MatchmakingStatusResult,
} from './matchmaking.repository.js';

import { LobbiesService } from '../lobbies/lobbies.service.js';
import { LobbyVisibility } from '../lobbies/lobby.entity.js';

@Injectable()
export class MatchmakingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingService.name);

  /** Pure planner; no queue state lives inside the engine. */
  private readonly engine: MatchmakingEngine;

  /** Poll interval handle for the in-process scheduler. */
  private intervalId: NodeJS.Timeout | null = null;

  /** Prevents overlapping ticks inside this process. */
  private isProcessing = false;

  private readonly tickIntervalMs: number;

  constructor(
    private readonly repository: MatchmakingRepository,
    private readonly lobbiesService: LobbiesService,
    configService: ConfigService,
  ) {
    this.engine = new MatchmakingEngine({
      strategyResolver: getScoringStrategy,
      searchWindow: readPositiveInteger(
        configService.get('MATCHMAKING_SEARCH_WINDOW'),
        DEFAULT_SEARCH_WINDOW,
      ),
    });

    this.tickIntervalMs = readPositiveInteger(
      configService.get('MATCHMAKING_TICK_INTERVAL_MS'),
      DEFAULT_TICK_INTERVAL_MS,
    );
  }

  // ── NestJS lifecycle ──────────────────────────────────────────────────

  onModuleInit(): void {
    this.intervalId = setInterval(() => {
      void this.tick();
    }, this.tickIntervalMs);

    this.logger.log(
      `Matchmaking service initialized (tick every ${this.tickIntervalMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.log('Matchmaking service destroyed');
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Add a player to the matchmaking queue.
   *
   * @throws ConflictException if the player already has a pending match.
   * @returns true if the player was added, false if already queued.
   */
  async enqueue(player: PlayerMatchmakingInput): Promise<boolean> {
    const outcome = await this.repository.enqueue(player);

    if (outcome === EnqueueOutcome.PENDING_MATCH) {
      throw new ConflictException(
        'You already have a pending match. Open your lobby first.',
      );
    }

    return outcome === EnqueueOutcome.QUEUED;
  }

  /**
   * Manually trigger one tick. The endpoint is disabled in production, but
   * the method stays available for tests and simulations.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const result = await this.repository.runTick(
        (entries, now) =>
          this.engine.planGroups(
            entries.map((entry) => ({
              player: entry.player,
              enqueuedAt: entry.enqueuedAt.getTime(),
            })),
            now,
          ),
        (group, manager) => this.handleMatchFound(group, manager),
      );

      if (!result.processed) {
        this.logger.debug(
          'Skipped tick because another instance holds the advisory lock',
        );
        return;
      }

      for (const match of result.matches) {
        this.logger.log(
          `Match ${match.group.groupId} → lobby ${match.lobbyId} ` +
            `(${match.group.userIds.length} players, score ${match.group.score.toFixed(2)})`,
        );
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /** Remove a player from the matchmaking queue by user ID. */
  async dequeue(userId: string): Promise<boolean> {
    return this.repository.dequeue(userId);
  }

  /**
   * Check whether a user has been matched and, if so, return the lobby ID.
   * Queued users receive a heartbeat from this call.
   */
  async getMatchStatus(userId: string): Promise<MatchmakingStatusResult> {
    return this.repository.getMatchStatus(userId);
  }

  /** Observability helpers used by tests and health checks. */
  async getQueueSnapshot() {
    return this.repository.getQueueSnapshot();
  }

  async getTotalQueueSize(): Promise<number> {
    return this.repository.getTotalQueueSize();
  }

  // ── Internal: polling loop ────────────────────────────────────────────

  private async tick(): Promise<void> {
    try {
      await this.processQueue();
    } catch (error) {
      this.logger.error(
        'processQueue tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Internal: match found → lobby creation ────────────────────────────

  /**
   * Creates the lobby inside the tick transaction and returns its ID.
   * Any failure propagates, rolling back the whole tick so players stay
   * queued and can be retried.
   */
  private async handleMatchFound(
    matchGroup: MatchGroup,
    manager: EntityManager,
  ): Promise<string> {
    const [hostUserId, ...memberUserIds] = matchGroup.userIds;

    if (!hostUserId) {
      throw new Error(`Match ${matchGroup.groupId} has no players.`);
    }

    const lobby = await this.lobbiesService.createWithMembers(
      {
        lobbyName: `${matchGroup.game} Squad`,
        subtitle: `Matched via CampusGG`,
        details: `Auto-matched group · compatibility ${(
          matchGroup.score * 100
        ).toFixed(0)}% · ${matchGroup.userIds.length} players`,
        game: matchGroup.game,
        participantLimit: matchGroup.userIds.length,
        visibility: LobbyVisibility.PRIVATE,
        tags: ['matchmaking'],
      },
      hostUserId,
      memberUserIds,
      manager,
    );

    return lobby.id;
  }
}
