import type {
  PlayerMatchmakingInput,
  SupportedGame,
} from '../schemas/player-matchmaking.schema.js';
import { DummyStrategy } from './match-strategy.interface.js';
import type { MatchStrategy } from './match-strategy.interface.js';
import { MatchmakingEngine } from './matchmaking-engine.js';

let userCounter = 0;

function makePlayer(
  overrides: Partial<PlayerMatchmakingInput> = {},
): PlayerMatchmakingInput {
  userCounter += 1;

  return {
    userId: `usr_test_${userCounter}`,
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

function fixedStrategy(score: number): MatchStrategy {
  return { scoreGroup: () => score };
}

describe('MatchmakingEngine', () => {
  beforeEach(() => {
    userCounter = 0;
  });

  it('forms a group when the score meets the initial threshold', async () => {
    const onMatchFound = jest.fn();
    const engine = new MatchmakingEngine({
      strategyResolver: () => new DummyStrategy(),
      onMatchFound,
      now: () => 0,
    });

    for (let index = 0; index < 5; index++) {
      engine.enqueue(makePlayer());
    }

    const groups = await engine.processQueue(0);

    expect(groups).toHaveLength(1);
    expect(groups[0].score).toBe(0.85);
    expect(groups[0].tier).toBe('Competitive');
    expect(onMatchFound).toHaveBeenCalledTimes(1);
    expect(engine.getTotalQueueSize()).toBe(0);
  });

  it('plans groups from an external snapshot without touching engine state', () => {
    const onMatchFound = jest.fn();
    const engine = new MatchmakingEngine({
      strategyResolver: () => fixedStrategy(1),
      onMatchFound,
      now: () => 0,
    });

    const entries = Array.from({ length: 5 }, () => ({
      player: makePlayer(),
      enqueuedAt: 0,
    }));

    const groups = engine.planGroups(entries, 0);

    expect(groups).toHaveLength(1);
    expect(groups[0].userIds).toEqual(
      entries.map((entry) => entry.player.userId),
    );
    expect(onMatchFound).not.toHaveBeenCalled();
    expect(engine.getTotalQueueSize()).toBe(0);
  });

  it('uses the strategy for the game being processed', async () => {
    const strategyResolver = jest.fn((game: SupportedGame) =>
      game === 'It Takes Two' ? fixedStrategy(1) : fixedStrategy(0.1),
    );

    const engine = new MatchmakingEngine({
      strategyResolver,
      now: () => 0,
    });

    engine.enqueue(
      makePlayer({
        game: 'It Takes Two',
        intensity: 0.1,
        stats: { game: 'It Takes Two', rating: 0 },
      }),
    );
    engine.enqueue(
      makePlayer({
        game: 'It Takes Two',
        intensity: 0.9,
        stats: { game: 'It Takes Two', rating: 0 },
      }),
    );

    const groups = await engine.processQueue(0);

    expect(groups).toHaveLength(1);
    expect(groups[0].game).toBe('It Takes Two');
    expect(groups[0].tier).toBe('Casual');
    expect(groups[0].userIds).toHaveLength(2);
  });

  it('derives wait time from the server-side enqueue timestamp', async () => {
    const engine = new MatchmakingEngine({
      strategyResolver: () => fixedStrategy(0.5),
      now: () => 0,
    });

    for (let index = 0; index < 5; index++) {
      engine.enqueue(makePlayer(), 0);
    }

    // 0.5 < 0.85 at t=0
    expect(await engine.processQueue(0)).toHaveLength(0);

    // 0.5 < 0.60 at t=180s
    expect(await engine.processQueue(180_000)).toHaveLength(0);

    // 0.5 >= 0.30 at t=300s
    expect(await engine.processQueue(300_000)).toHaveLength(1);
  });

  it('finds the best group in the window instead of blocking on the head', async () => {
    const targetIds = new Set<string>();
    const strategy: MatchStrategy = {
      scoreGroup: (group) =>
        group.every((player) => targetIds.has(player.userId)) ? 1 : 0.1,
    };

    const engine = new MatchmakingEngine({
      strategyResolver: () => strategy,
      now: () => 0,
    });

    for (let index = 0; index < 5; index++) {
      engine.enqueue(makePlayer());
    }

    for (let index = 0; index < 5; index++) {
      const player = makePlayer();
      targetIds.add(player.userId);
      engine.enqueue(player);
    }

    const groups = await engine.processQueue(0);

    expect(groups).toHaveLength(1);
    expect(groups[0].userIds.every((userId) => targetIds.has(userId))).toBe(
      true,
    );
    expect(engine.getTotalQueueSize()).toBe(5);
  });

  it('keeps players queued when the match handoff fails', async () => {
    const engine = new MatchmakingEngine({
      strategyResolver: () => fixedStrategy(1),
      onMatchFound: () => {
        throw new Error('lobby creation failed');
      },
      now: () => 0,
    });

    for (let index = 0; index < 5; index++) {
      engine.enqueue(makePlayer());
    }

    const groups = await engine.processQueue(0);

    expect(groups).toHaveLength(0);
    expect(engine.getTotalQueueSize()).toBe(5);
  });

  it('awaits an asynchronous handoff before removing players', async () => {
    let resolveHandoff!: () => void;
    const handoff = new Promise<void>((resolve) => {
      resolveHandoff = resolve;
    });

    const engine = new MatchmakingEngine({
      strategyResolver: () => fixedStrategy(1),
      onMatchFound: () => handoff,
      now: () => 0,
    });

    for (let index = 0; index < 5; index++) {
      engine.enqueue(makePlayer());
    }

    const processing = engine.processQueue(0);

    expect(engine.getTotalQueueSize()).toBe(5);

    resolveHandoff();
    await processing;

    expect(engine.getTotalQueueSize()).toBe(0);
  });

  it('rejects duplicate users across game partitions', () => {
    const engine = new MatchmakingEngine({
      strategyResolver: () => new DummyStrategy(),
      now: () => 0,
    });

    const player = makePlayer();
    expect(engine.enqueue(player)).toBe(true);
    expect(engine.enqueue({ ...player, game: 'It Takes Two' })).toBe(false);
    expect(engine.getTotalQueueSize()).toBe(1);
  });

  it('removes a user from every partition on dequeue', () => {
    const engine = new MatchmakingEngine({
      strategyResolver: () => new DummyStrategy(),
      now: () => 0,
    });

    const player = makePlayer();
    engine.enqueue(player);
    expect(engine.dequeue(player.userId)).toBe(true);
    expect(engine.getTotalQueueSize()).toBe(0);
    expect(engine.dequeue(player.userId)).toBe(false);
  });

  it('rejects an unknown game at enqueue time', () => {
    const engine = new MatchmakingEngine({
      strategyResolver: () => new DummyStrategy(),
      now: () => 0,
    });

    expect(() =>
      engine.enqueue(
        makePlayer({
          game: 'Not A Real Game' as PlayerMatchmakingInput['game'],
        }),
      ),
    ).toThrow();
  });
});
