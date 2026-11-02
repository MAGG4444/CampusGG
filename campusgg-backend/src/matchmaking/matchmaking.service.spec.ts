import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';

import type { LobbiesService } from '../lobbies/lobbies.service.js';
import type {
  MatchmakingMatchHandler,
  MatchmakingPlanner,
  MatchmakingRepository,
  MatchmakingTickMatch,
  MatchmakingTickResult,
  PersistedMatchmakingEntry,
} from './matchmaking.repository.js';
import { EnqueueOutcome } from './matchmaking.repository.js';
import type { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema.js';
import { MatchmakingService } from './matchmaking.service.js';

let userCounter = 0;

function makePlayer(
  overrides: Partial<PlayerMatchmakingInput> = {},
): PlayerMatchmakingInput {
  userCounter += 1;

  return {
    userId: `usr_service_${userCounter}`,
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
    ...overrides,
  };
}

function setup() {
  const repository = {
    enqueue: jest.fn().mockResolvedValue(EnqueueOutcome.QUEUED),
    dequeue: jest.fn().mockResolvedValue(true),
    getMatchStatus: jest
      .fn()
      .mockResolvedValue({ matched: false, queued: false }),
    runTick: jest.fn(),
    getQueueSnapshot: jest.fn().mockResolvedValue({}),
    getTotalQueueSize: jest.fn().mockResolvedValue(0),
  };

  const lobbiesService = {
    createWithMembers: jest.fn().mockResolvedValue({ id: 'lobby-1' }),
  };

  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  const service = new MatchmakingService(
    repository as unknown as MatchmakingRepository,
    lobbiesService as unknown as LobbiesService,
    configService as unknown as ConfigService,
  );

  // Stop the scheduler; tests drive processQueue() directly.
  service.onModuleInit();
  service.onModuleDestroy();

  return { service, repository, lobbiesService };
}

/**
 * Simulates the repository tick: invoke the planner with the supplied
 * snapshot, then call the lobby handler once per planned group.
 */
function mockSuccessfulTick(
  repository: ReturnType<typeof setup>['repository'],
  entries: PersistedMatchmakingEntry[],
  now = Date.now(),
): void {
  repository.runTick.mockImplementation(
    async (
      planner: MatchmakingPlanner,
      onMatchFound: MatchmakingMatchHandler,
    ): Promise<MatchmakingTickResult> => {
      const groups = planner(entries, now);
      const manager = {} as EntityManager;
      const matches: MatchmakingTickMatch[] = [];

      for (const group of groups) {
        const lobbyId = await onMatchFound(group, manager);
        matches.push({ group, lobbyId });
      }

      return { processed: true, matches, loadedEntries: entries.length };
    },
  );
}

describe('MatchmakingService', () => {
  beforeEach(() => {
    userCounter = 0;
    jest.restoreAllMocks();
  });

  it('reports whether the repository queued the player', async () => {
    const { service, repository } = setup();
    const player = makePlayer();

    await expect(service.enqueue(player)).resolves.toBe(true);
    expect(repository.enqueue).toHaveBeenCalledWith(player);

    repository.enqueue.mockResolvedValue(EnqueueOutcome.ALREADY_QUEUED);
    await expect(service.enqueue(player)).resolves.toBe(false);
  });

  it('rejects enqueue while an active match result exists', async () => {
    const { service, repository } = setup();
    repository.enqueue.mockResolvedValue(EnqueueOutcome.PENDING_MATCH);

    await expect(service.enqueue(makePlayer())).rejects.toThrow(
      ConflictException,
    );
  });

  it('delegates queue removal and status polling', async () => {
    const { service, repository } = setup();
    const status = { matched: true, queued: false, lobbyId: 'lobby-1' };
    repository.getMatchStatus.mockResolvedValue(status);

    await expect(service.dequeue('usr-1')).resolves.toBe(true);
    await expect(service.getMatchStatus('usr-1')).resolves.toEqual(status);

    expect(repository.dequeue).toHaveBeenCalledWith('usr-1');
    expect(repository.getMatchStatus).toHaveBeenCalledWith('usr-1');
  });

  it('plans a group and creates its lobby inside the tick manager', async () => {
    const { service, repository, lobbiesService } = setup();
    const players = Array.from({ length: 5 }, () => makePlayer());
    const now = Date.now();
    const entries = players.map((player, index) => ({
      entryId: `entry-${index}`,
      player,
      enqueuedAt: new Date(now),
    }));

    mockSuccessfulTick(repository, entries, now);

    await service.processQueue();

    expect(lobbiesService.createWithMembers).toHaveBeenCalledTimes(1);
    expect(lobbiesService.createWithMembers).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'CS2', participantLimit: 5 }),
      players[0].userId,
      expect.arrayContaining(players.slice(1).map((player) => player.userId)),
      expect.any(Object),
    );
  });

  it('uses the casual strategy for It Takes Two', async () => {
    const { service, repository, lobbiesService } = setup();
    const players = [
      makePlayer({
        game: 'It Takes Two',
        intensity: 0,
        stats: { game: 'It Takes Two', rating: 0 },
      }),
      makePlayer({
        game: 'It Takes Two',
        intensity: 1,
        stats: { game: 'It Takes Two', rating: 0 },
      }),
    ];
    const now = Date.now();

    mockSuccessfulTick(
      repository,
      players.map((player, index) => ({
        entryId: `entry-${index}`,
        player,
        enqueuedAt: new Date(now),
      })),
      now,
    );

    await service.processQueue();

    expect(lobbiesService.createWithMembers).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'It Takes Two', participantLimit: 2 }),
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('propagates lobby creation failures so the tick rolls back', async () => {
    const { service, repository, lobbiesService } = setup();
    const players = Array.from({ length: 5 }, () => makePlayer());
    const now = Date.now();

    lobbiesService.createWithMembers.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    mockSuccessfulTick(
      repository,
      players.map((player, index) => ({
        entryId: `entry-${index}`,
        player,
        enqueuedAt: new Date(now),
      })),
      now,
    );

    await expect(service.processQueue()).rejects.toThrow(
      'database unavailable',
    );
  });

  it('skips lobby work when another instance owns the tick lock', async () => {
    const { service, repository, lobbiesService } = setup();
    repository.runTick.mockResolvedValue({
      processed: false,
      matches: [],
      loadedEntries: 0,
    });

    await service.processQueue();

    expect(lobbiesService.createWithMembers).not.toHaveBeenCalled();
  });

  it('delegates observability queries', async () => {
    const { service, repository } = setup();
    repository.getQueueSnapshot.mockResolvedValue({ CS2: 4 });
    repository.getTotalQueueSize.mockResolvedValue(4);

    await expect(service.getQueueSnapshot()).resolves.toEqual({ CS2: 4 });
    await expect(service.getTotalQueueSize()).resolves.toBe(4);
  });
});
