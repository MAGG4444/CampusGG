/**
 * PostgreSQL integration tests for the matchmaking persistence layer.
 *
 * Run with a dedicated database:
 *   TEST_DATABASE_URL=postgresql://campusgg:campusgg_dev@localhost:5432/campusgg_test \
 *     npm run migration:run && npm run test:integration
 *
 * The suite is skipped when TEST_DATABASE_URL is not set, so unit tests and
 * a developer's normal `.env` database are never touched by accident.
 */

import { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager } from 'typeorm';

import { AppDataSource } from '../src/database/data-source.js';
import { MatchmakingEngine } from '../src/matchmaking/engine/matchmaking-engine.js';
import { getScoringStrategy } from '../src/matchmaking/engine/strategy-registry.js';
import { Lobby } from '../src/lobbies/lobby.entity.js';
import {
  MatchmakingEntry,
  MatchmakingStatus,
} from '../src/matchmaking/entities/matchmaking-entry.entity.js';
import {
  EnqueueOutcome,
  MATCHMAKING_TICK_LOCK_KEY,
  MatchmakingConcurrencyError,
  MatchmakingRepository,
  type MatchmakingPlanner,
} from '../src/matchmaking/matchmaking.repository.js';
import type { MatchGroup } from '../src/matchmaking/schemas/match-group.schema.js';
import type { PlayerMatchmakingInput } from '../src/matchmaking/schemas/player-matchmaking.schema.js';
import { User } from '../src/users/user.entity.js';

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const describeIntegration = hasTestDatabase ? describe : describe.skip;

if (!hasTestDatabase) {
  console.warn(
    '[integration] TEST_DATABASE_URL is not set; skipping matchmaking repository tests.',
  );
}

describeIntegration('MatchmakingRepository (PostgreSQL)', () => {
  let dataSource: DataSource;
  let repository: MatchmakingRepository;

  const engine = new MatchmakingEngine({
    strategyResolver: getScoringStrategy,
  });

  const planner: MatchmakingPlanner = (entries, now) =>
    engine.planGroups(
      entries.map((entry) => ({
        player: entry.player,
        enqueuedAt: entry.enqueuedAt.getTime(),
      })),
      now,
    );

  beforeAll(async () => {
    dataSource = AppDataSource;

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    await dataSource.runMigrations();

    repository = new MatchmakingRepository(dataSource, new ConfigService());
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(`
      TRUNCATE TABLE
        "matchmaking_entries",
        "lobby_members",
        "lobbies",
        "forum_post_likes",
        "forum_comments",
        "forum_posts",
        "users"
      RESTART IDENTITY CASCADE
    `);
  });

  it('enqueues once per user and dequeues only queued rows', async () => {
    const [userId] = await seedUsers(1);
    const player = makePlayer(userId);

    await expect(repository.enqueue(player)).resolves.toBe(
      EnqueueOutcome.QUEUED,
    );
    await expect(repository.enqueue(player)).resolves.toBe(
      EnqueueOutcome.ALREADY_QUEUED,
    );

    await expect(repository.dequeue(userId)).resolves.toBe(true);
    await expect(repository.dequeue(userId)).resolves.toBe(false);
  });

  it('returns queue state and refreshes the heartbeat', async () => {
    const [userId] = await seedUsers(1);

    await repository.enqueue(makePlayer(userId));
    await dataSource.query(
      `UPDATE "matchmaking_entries"
       SET "heartbeat_at" = now() - interval '30 seconds'
       WHERE "user_id" = $1`,
      [userId],
    );

    const status = await repository.getMatchStatus(userId);

    expect(status).toMatchObject({
      matched: false,
      queued: true,
      game: 'CS2',
    });
    expect(typeof status.enqueuedAt).toBe('string');

    const entry = await dataSource
      .getRepository(MatchmakingEntry)
      .findOneByOrFail({ userId });

    expect(Date.now() - entry.heartbeatAt.getTime()).toBeLessThan(5_000);
    expect(entry.status).toBe(MatchmakingStatus.QUEUED);
  });

  it('persists a match, creates its lobby, and serves the result idempotently', async () => {
    const userIds = await seedUsers(5);

    for (const userId of userIds) {
      await repository.enqueue(makePlayer(userId));
    }

    const result = await repository.runTick(planner, createLobbyHandler());

    expect(result.processed).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(new Set(result.matches[0].group.userIds)).toEqual(new Set(userIds));

    const lobbyId = result.matches[0].lobbyId;
    const entries = await dataSource.getRepository(MatchmakingEntry).find();

    expect(entries).toHaveLength(5);
    expect(
      entries.every(
        (entry) =>
          entry.status === MatchmakingStatus.MATCHED &&
          entry.lobbyId === lobbyId,
      ),
    ).toBe(true);

    await expect(repository.getMatchStatus(userIds[0])).resolves.toEqual({
      matched: true,
      queued: false,
      lobbyId,
      game: 'CS2',
    });

    // The matched rows are no longer part of the queued batch.
    const secondTick = await repository.runTick(planner, createLobbyHandler());
    expect(secondTick.matches).toHaveLength(0);
  });

  it('rolls back the lobby when a planned player dequeues mid-tick', async () => {
    const userIds = await seedUsers(5);

    for (const userId of userIds) {
      await repository.enqueue(makePlayer(userId));
    }

    const createLobby = createLobbyHandler();

    const racingHandler = async (
      group: MatchGroup,
      manager: EntityManager,
    ): Promise<string> => {
      // Simulate a dequeue that commits after planning but before the
      // mark-matched update. Within this transaction it removes a row, so
      // the affected-row guard must reject the under-filled group.
      await manager.delete(MatchmakingEntry, {
        userId: group.userIds[0],
      });

      return createLobby(group, manager);
    };

    await expect(
      repository.runTick(planner, racingHandler),
    ).rejects.toBeInstanceOf(MatchmakingConcurrencyError);

    const entries = await dataSource.getRepository(MatchmakingEntry).find();
    const lobbies = await dataSource.getRepository(Lobby).count();

    // The delete and lobby insert were rolled back with the tick.
    expect(entries).toHaveLength(5);
    expect(
      entries.every((entry) => entry.status === MatchmakingStatus.QUEUED),
    ).toBe(true);
    expect(lobbies).toBe(0);
  });

  it('cleans stale queued rows before planning', async () => {
    const userIds = await seedUsers(5);

    for (const userId of userIds) {
      await repository.enqueue(makePlayer(userId));
    }

    await dataSource.query(
      `UPDATE "matchmaking_entries"
       SET "heartbeat_at" = now() - interval '3 minutes'`,
    );

    const plannerSpy = jest.fn(planner);
    const handlerSpy = jest.fn(createLobbyHandler());

    const result = await repository.runTick(plannerSpy, handlerSpy);

    expect(result.processed).toBe(true);
    expect(result.loadedEntries).toBe(0);
    expect(plannerSpy).toHaveBeenCalledWith([], expect.any(Number));
    expect(handlerSpy).not.toHaveBeenCalled();
    expect(await dataSource.getRepository(MatchmakingEntry).count()).toBe(0);
  });

  it('removes expired match results and allows a new queue entry', async () => {
    const userIds = await seedUsers(5);

    for (const userId of userIds) {
      await repository.enqueue(makePlayer(userId));
    }

    await repository.runTick(planner, createLobbyHandler());

    await dataSource.query(
      `UPDATE "matchmaking_entries"
       SET "match_expires_at" = now() - interval '1 second'`,
    );

    const result = await repository.runTick(planner, createLobbyHandler());

    expect(result.loadedEntries).toBe(0);
    expect(await dataSource.getRepository(MatchmakingEntry).count()).toBe(0);

    await expect(repository.enqueue(makePlayer(userIds[0]))).resolves.toBe(
      EnqueueOutcome.QUEUED,
    );
  });

  it('skips the tick when another instance holds the advisory lock', async () => {
    await dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        MATCHMAKING_TICK_LOCK_KEY,
      ]);

      const result = await repository.runTick(planner, createLobbyHandler());

      expect(result.processed).toBe(false);
      expect(result.matches).toHaveLength(0);
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────────

  async function seedUsers(count: number): Promise<string[]> {
    const users = Array.from({ length: count }, (_, index) =>
      dataSource.getRepository(User).create({
        email: `integration-${Date.now()}-${index}-${Math.random()
          .toString(16)
          .slice(2)}@example.test`,
        username: `int_${Date.now()}_${index}_${Math.random()
          .toString(16)
          .slice(2, 8)}`,
        displayName: 'Integration Test',
        eduVerified: true,
      }),
    );

    const saved = await dataSource.getRepository(User).save(users);
    return saved.map((user) => user.id);
  }

  function createLobbyHandler() {
    return async (
      group: MatchGroup,
      manager: EntityManager,
    ): Promise<string> => {
      const host = await manager.getRepository(User).findOneBy({
        id: group.userIds[0],
      });

      if (!host) {
        throw new Error('Integration test host is missing');
      }

      const lobby = manager.create(Lobby, {
        lobbyName: `${group.game} Integration Squad`,
        details: 'Created by matchmaking integration tests',
        tags: ['matchmaking'],
        game: group.game,
        participantLimit: group.userIds.length,
        host,
      });

      const saved = await manager.save(Lobby, lobby);
      return saved.id;
    };
  }
});

function makePlayer(userId: string): PlayerMatchmakingInput {
  return {
    userId,
    game: 'CS2',
    profile: {
      universityDomain: 'purdue.edu',
      major: 'Computer Science',
      activeSchedule: 'Weekday Evening',
    },
    stats: { game: 'CS2', rating: 15000 },
    preferences: {
      primaryRole: 'IGL',
      secondaryRole: 'Support',
      micEnabled: true,
    },
    intensity: 0.5,
  };
}
