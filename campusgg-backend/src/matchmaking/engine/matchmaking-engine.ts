/**
 * @file matchmaking-engine.ts
 * @description Sub-issue 23.2 — Core Matchmaking Engine
 *
 * Implements the queue management loop that:
 *   1. Accepts players via `enqueue()`
 *   2. Hard-partitions the queue by game
 *   3. Dynamically determines group size from the game's tier
 *   4. Searches a bounded window for the best-scoring candidate group
 *   5. Delegates scoring to the strategy for that specific game
 *   6. Emits MatchGroup payloads via the `onMatchFound` callback
 *
 * Boundary responsibilities (what this class does NOT do):
 *   - Does NOT implement scoring math (deferred to MatchStrategy)
 *   - Does NOT manage lobby state (owned by the Lobby service)
 *   - Does NOT persist data (stateless in-memory queue)
 *
 * Design principles:
 *   - Single Responsibility : queue plumbing only
 *   - Open/Closed           : new games/tiers require zero engine changes
 *   - Dependency Inversion  : depends on MatchStrategy interface, not impl
 *   - Interface Segregation : one callback, one strategy method
 *
 * Wait time is recorded server-side at enqueue time. The engine never trusts
 * a client-supplied queue duration.
 */

import * as crypto from 'crypto';

import type {
  PlayerMatchmakingInput,
  SupportedGame,
} from '../schemas/player-matchmaking.schema.js';
import type { MatchGroup } from '../schemas/match-group.schema.js';
import type { MatchStrategy } from './match-strategy.interface.js';
import { getGroupSize, getTier } from './game-tiers.config.js';
import { resolveGroupThreshold } from './time-decay-model.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default number of players considered when searching for a group.
 *
 * With 5-player groups, a window of 15 means at most C(15, 5) = 3003
 * candidate groups per match. This is small enough to run every few
 * seconds while still letting the engine find a good group instead of
 * being blocked by the first five players in the queue.
 */
const DEFAULT_SEARCH_WINDOW = 15;

/** Upper bound to keep the combinatorial search predictable. */
const MAX_SEARCH_WINDOW = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Internal queue entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A player plus the server-side timestamp at which they entered the queue.
 * The timestamp is the only source of truth for elapsed wait time.
 *
 * Exported so the persistence layer can hand a snapshot of queued players to
 * the pure `planGroups()` planner without owning any engine state.
 */
export interface QueueEntry {
  readonly player: PlayerMatchmakingInput;
  readonly enqueuedAt: number;
}

/** A candidate group that passed the dynamic threshold. */
interface CandidateGroup {
  /** Indices into the window array, in ascending order. */
  readonly indices: ReadonlyArray<number>;
  readonly entries: ReadonlyArray<QueueEntry>;
  readonly score: number;
  readonly threshold: number;
  readonly maxWait: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Callback type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signature for the match-found callback.
 *
 * The callback may be asynchronous. The engine awaits it and only removes
 * the players from the queue after it resolves successfully. If it rejects,
 * the players stay queued so a transient lobby-creation failure cannot
 * strand them.
 */
export type OnMatchFoundCallback = (
  matchGroup: MatchGroup,
) => void | Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// Engine options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constructor options for the MatchmakingEngine.
 */
export interface MatchmakingEngineOptions {
  /**
   * Resolves the scoring strategy for a specific game. This is called once
   * per partition per tick, so switching between competitive and casual
   * games is handled without the engine knowing about tiers or game names.
   */
  readonly strategyResolver: (game: SupportedGame) => MatchStrategy;

  /**
   * Callback fired whenever a match group is successfully formed.
   * Defaults to a no-op if not provided.
   */
  readonly onMatchFound?: OnMatchFoundCallback;

  /**
   * Optional clock injection for deterministic tests. Defaults to Date.now.
   */
  readonly now?: () => number;

  /**
   * Number of players to consider when searching for the best group.
   * Defaults to DEFAULT_SEARCH_WINDOW (15), clamped to MAX_SEARCH_WINDOW.
   */
  readonly searchWindow?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The core matchmaking engine.
 */
export class MatchmakingEngine {
  // ── Internal state ──────────────────────────────────────────────────────

  /**
   * The player queue, keyed by game title.
   * Each game gets its own isolated sub-queue (hard partitioning).
   * Using a Map preserves insertion order within each partition.
   */
  private readonly queue: Map<SupportedGame, QueueEntry[]> = new Map();

  /** Resolves the scoring strategy for each game partition. */
  private readonly strategyResolver: (game: SupportedGame) => MatchStrategy;

  /** Callback invoked for every accepted match group. */
  private readonly onMatchFound: OnMatchFoundCallback;

  /** Clock used for enqueue timestamps and elapsed-time calculations. */
  private readonly now: () => number;

  /** Number of players considered in the best-group search. */
  private readonly searchWindow: number;

  // ── Constructor ─────────────────────────────────────────────────────────

  constructor(options: MatchmakingEngineOptions) {
    this.strategyResolver = options.strategyResolver;
    this.onMatchFound = options.onMatchFound ?? (() => {});
    this.now = options.now ?? Date.now;
    this.searchWindow = Math.min(
      Math.max(1, options.searchWindow ?? DEFAULT_SEARCH_WINDOW),
      MAX_SEARCH_WINDOW,
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Add a player to the matchmaking queue.
   *
   * The player is routed to the sub-queue for their `game` field. A user may
   * only be queued once at a time: duplicates are rejected across all game
   * partitions to prevent a user being matched into multiple lobbies.
   *
   * @param player     - A validated PlayerMatchmakingInput payload.
   * @param enqueuedAt - Optional server timestamp override (used by the mock
   *                     runner to simulate already-waiting players).
   * @returns true if the player was added, false if they were already queued.
   */
  enqueue(player: PlayerMatchmakingInput, enqueuedAt = this.now()): boolean {
    // Validate the game up front so an unknown title cannot poison the queue.
    getTier(player.game);

    // Guard: one active queue entry per user across all games.
    for (const entries of this.queue.values()) {
      if (entries.some((entry) => entry.player.userId === player.userId)) {
        console.warn(
          `[Engine] Duplicate enqueue rejected: ${player.userId} is already queued.`,
        );
        return false;
      }
    }

    // Initialise the sub-queue for this game if it doesn't exist yet
    if (!this.queue.has(player.game)) {
      this.queue.set(player.game, []);
    }

    const timestamp = Number.isFinite(enqueuedAt) ? enqueuedAt : this.now();
    this.queue.get(player.game)!.push({ player, enqueuedAt: timestamp });
    return true;
  }

  /**
   * Remove a player from the matchmaking queue by user ID.
   * Searches all game partitions and removes every matching entry.
   *
   * @param userId - The ID of the player to remove.
   * @returns true if at least one entry was found and removed.
   */
  dequeue(userId: string): boolean {
    let removed = false;

    for (const entries of this.queue.values()) {
      for (let index = entries.length - 1; index >= 0; index--) {
        if (entries[index].player.userId === userId) {
          entries.splice(index, 1);
          removed = true;
        }
      }
    }

    return removed;
  }

  /**
   * Process the entire queue once.
   *
   * For each game partition, repeatedly finds the best-scoring group within
   * a bounded search window. The callback is awaited before matched players
   * are removed, so a failed lobby creation leaves them in the queue.
   *
   * @param now - Optional timestamp override for deterministic tests.
   * @returns Array of MatchGroup payloads that were handed off.
   */
  async processQueue(now = this.now()): Promise<MatchGroup[]> {
    const formedGroups: MatchGroup[] = [];

    // Iterate over every game partition independently (hard partitioning)
    for (const [game, players] of this.queue.entries()) {
      try {
        const plannedGroups = this.planPartition(game, players, now);

        for (const matchGroup of plannedGroups) {
          // Await the handoff BEFORE removing players. If lobby creation
          // fails, the players remain queued and can be retried next tick.
          await this.onMatchFound(matchGroup);
          this.removeUsers(players, matchGroup.userIds);
          formedGroups.push(matchGroup);
        }
      } catch (error) {
        // One bad partition (or a failed lobby handoff) must not stop the
        // other games from being processed on this tick.
        console.error(
          `[Engine] Failed to process ${game} partition:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return formedGroups;
  }

  /**
   * Pure planner used by the PostgreSQL-backed queue.
   *
   * The caller supplies the queue snapshot (loaded inside a transaction) and
   * this method returns every group that can be formed at `now`. It does not
   * mutate the input, call the handoff callback, or touch internal state.
   *
   * Grouping is still hard-partitioned by game and uses the same best-of-
   * window search and dynamic wait-time threshold as `processQueue()`.
   */
  planGroups(
    entries: ReadonlyArray<QueueEntry>,
    now = this.now(),
  ): MatchGroup[] {
    const partitions = new Map<SupportedGame, QueueEntry[]>();

    for (const entry of entries) {
      const game = entry.player.game;

      if (!partitions.has(game)) {
        partitions.set(game, []);
      }

      partitions.get(game)!.push({
        player: entry.player,
        enqueuedAt: entry.enqueuedAt,
      });
    }

    const plannedGroups: MatchGroup[] = [];

    for (const [game, players] of partitions.entries()) {
      plannedGroups.push(...this.planPartition(game, players, now));
    }

    return plannedGroups;
  }

  // ── Internal: partition processing ──────────────────────────────────────

  /**
   * Plans as many groups as possible for a single game partition without
   * mutating the supplied array.
   */
  private planPartition(
    game: SupportedGame,
    players: ReadonlyArray<QueueEntry>,
    now: number,
  ): MatchGroup[] {
    const groupSize = getGroupSize(game);
    const tier = getTier(game);
    const plannedGroups: MatchGroup[] = [];
    const remaining = [...players];

    while (remaining.length >= groupSize) {
      const candidate = this.findBestGroup(game, remaining, groupSize, now);

      // No acceptable group in the search window — wait for the threshold
      // to decay or for more players to arrive.
      if (!candidate) {
        break;
      }

      plannedGroups.push({
        groupId: `grp_${crypto.randomUUID()}`,
        game,
        tier,
        userIds: candidate.entries.map((entry) => entry.player.userId),
        score: candidate.score,
        matchedAt: new Date(now).toISOString(),
      });

      // Descending order keeps earlier indices valid while splicing.
      const indices = [...candidate.indices].sort((a, b) => b - a);
      for (const index of indices) {
        remaining.splice(index, 1);
      }
    }

    return plannedGroups;
  }

  /** Removes every matching user from a mutable partition. */
  private removeUsers(
    players: QueueEntry[],
    userIds: ReadonlyArray<string>,
  ): void {
    const matched = new Set(userIds);

    for (let index = players.length - 1; index >= 0; index--) {
      if (matched.has(players[index].player.userId)) {
        players.splice(index, 1);
      }
    }
  }

  /**
   * Finds the best-scoring candidate group within the search window.
   *
   * Every combination of `groupSize` players from the first
   * `searchWindow` players is scored. A group is eligible only if its score
   * meets the dynamic threshold derived from its own wait times. Among
   * eligible groups, the highest score wins; ties are broken in favour of
   * the group whose longest waiter has waited longer.
   *
   * @returns The best eligible group, or null if none passes.
   */
  private findBestGroup(
    game: SupportedGame,
    players: ReadonlyArray<QueueEntry>,
    groupSize: number,
    now: number,
  ): CandidateGroup | null {
    const windowSize = Math.min(
      players.length,
      Math.max(this.searchWindow, groupSize),
    );

    if (windowSize < groupSize) {
      return null;
    }

    const window = players.slice(0, windowSize);
    const strategy = this.strategyResolver(game);

    let best: CandidateGroup | null = null;

    for (const indices of combinations(windowSize, groupSize)) {
      const entries = indices.map((index) => window[index]);

      const waitTimes = entries.map((entry) =>
        Math.max(0, (now - entry.enqueuedAt) / 1000),
      );
      const maxWait = Math.max(...waitTimes);
      const threshold = resolveGroupThreshold(waitTimes);

      const score = strategy.scoreGroup(entries.map((entry) => entry.player));

      // Defensive: malformed data must not produce a "match" with NaN.
      if (!Number.isFinite(score) || score < threshold) {
        continue;
      }

      const isBetter =
        best === null ||
        score > best.score ||
        (score === best.score && maxWait > best.maxWait);

      if (isBetter) {
        best = { indices, entries, score, threshold, maxWait };
      }
    }

    return best;
  }

  // ── Observability helpers ────────────────────────────────────────────────

  /**
   * Returns a snapshot of the current queue sizes per game.
   * Useful for logging, dashboards, and health checks.
   */
  getQueueSnapshot(): Partial<Record<SupportedGame, number>> {
    const snapshot: Partial<Record<SupportedGame, number>> = {};
    for (const [game, entries] of this.queue.entries()) {
      snapshot[game] = entries.length;
    }
    return snapshot;
  }

  /**
   * Returns the total number of players across all game queues.
   */
  getTotalQueueSize(): number {
    let total = 0;
    for (const entries of this.queue.values()) {
      total += entries.length;
    }
    return total;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Combination generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yields every k-element combination of the integers [0, n) in lexicographic
 * order. Implemented as a generator so the engine does not allocate an array
 * of every combination at once.
 *
 * @example
 * [...combinations(4, 2)] // [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]
 */
function* combinations(n: number, k: number): Generator<number[]> {
  if (k <= 0 || k > n) {
    return;
  }

  const current: number[] = [];

  function* recurse(start: number): Generator<number[]> {
    if (current.length === k) {
      yield current.slice();
      return;
    }

    const remaining = k - current.length;
    for (let index = start; index <= n - remaining; index++) {
      current.push(index);
      yield* recurse(index + 1);
      current.pop();
    }
  }

  yield* recurse(0);
}
