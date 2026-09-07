/**
 * @file matchmaking-engine.ts
 * @description Sub-issue 23.2 — Core Matchmaking Engine
 *
 * Implements the queue management loop that:
 *   1. Accepts players via `enqueue()`
 *   2. Hard-partitions the queue by game
 *   3. Dynamically determines group size from the game's tier
 *   4. Delegates scoring to an injected MatchStrategy
 *   5. Emits MatchGroup payloads via the `onMatchFound` callback
 *
 * Boundary responsibilities (what this class does NOT do):
 *   - Does NOT implement scoring math (deferred to 23.3 via Strategy Pattern)
 *   - Does NOT manage lobby state (owned by the Lobby service)
 *   - Does NOT persist data (stateless in-memory queue)
 *
 * Design principles:
 *   - Single Responsibility : queue plumbing only
 *   - Open/Closed           : new games/tiers require zero engine changes
 *   - Dependency Inversion  : depends on MatchStrategy interface, not impl
 *   - Interface Segregation : one callback, one strategy method
 */

import * as crypto from 'crypto';

import type { PlayerMatchmakingInput, SupportedGame } from '../schemas/player-matchmaking.schema.js';
import type { MatchGroup } from '../schemas/match-group.schema.js';
import type { MatchStrategy } from './match-strategy.interface.js';
import { getGroupSize, getTier } from './game-tiers.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default minimum score a candidate group must achieve to be accepted.
 * Can be overridden per-engine instance via the constructor.
 */
const DEFAULT_SCORE_THRESHOLD = 0.70;

// ─────────────────────────────────────────────────────────────────────────────
// Callback type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signature for the match-found callback.
 * The engine calls this with an immutable MatchGroup whenever a group passes
 * the score threshold. The Lobby service (or any consumer) hooks into this.
 */
export type OnMatchFoundCallback = (matchGroup: MatchGroup) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Engine options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constructor options for the MatchmakingEngine.
 * All fields are optional — sensible defaults are provided.
 */
export interface MatchmakingEngineOptions {
  /**
   * The scoring strategy to use when evaluating candidate groups.
   * Injected via constructor — enables swapping DummyStrategy for the real
   * scorer without touching engine code.
   */
  readonly strategy: MatchStrategy;

  /**
   * Callback fired whenever a match group is successfully formed.
   * Defaults to a no-op if not provided.
   */
  readonly onMatchFound?: OnMatchFoundCallback;

  /**
   * Minimum acceptable score from the strategy.
   * Groups scoring below this are rejected and their players stay in queue.
   * Defaults to DEFAULT_SCORE_THRESHOLD (0.70).
   */
  readonly scoreThreshold?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The core matchmaking engine.
 *
 * Usage:
 * ```ts
 * const engine = new MatchmakingEngine({
 *   strategy: new DummyStrategy(),
 *   onMatchFound: (group) => console.log('Match!', group),
 * });
 *
 * players.forEach((p) => engine.enqueue(p));
 * const results = engine.processQueue();
 * ```
 */
export class MatchmakingEngine {
  // ── Internal state ──────────────────────────────────────────────────────

  /**
   * The player queue, keyed by game title.
   * Each game gets its own isolated sub-queue (hard partitioning).
   * Using a Map preserves insertion order within each partition.
   */
  private readonly queue: Map<SupportedGame, PlayerMatchmakingInput[]> = new Map();

  /** Injected scoring strategy (DummyStrategy for 23.2, real scorer for 23.3). */
  private readonly strategy: MatchStrategy;

  /** Callback invoked for every accepted match group. */
  private readonly onMatchFound: OnMatchFoundCallback;

  /** Minimum score for a group to be accepted. */
  private readonly scoreThreshold: number;

  // ── Constructor ─────────────────────────────────────────────────────────

  constructor(options: MatchmakingEngineOptions) {
    this.strategy       = options.strategy;
    this.onMatchFound   = options.onMatchFound ?? (() => {});
    this.scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Add a player to the matchmaking queue.
   *
   * The player is routed to the sub-queue for their `game` field.
   * Duplicate user IDs within the same game partition are silently rejected
   * to prevent double-queuing.
   *
   * @param player - A validated PlayerMatchmakingInput payload.
   */
  enqueue(player: PlayerMatchmakingInput): void {
    const { game, userId } = player;

    // Initialise the sub-queue for this game if it doesn't exist yet
    if (!this.queue.has(game)) {
      this.queue.set(game, []);
    }

    const gameQueue = this.queue.get(game)!;

    // Guard: prevent duplicate enqueue
    if (gameQueue.some((p) => p.userId === userId)) {
      console.warn(`[Engine] Duplicate enqueue rejected: ${userId} already in ${game} queue.`);
      return;
    }

    gameQueue.push(player);
  }

  /**
   * Process the entire queue once.
   *
   * For each game partition:
   *   1. Look up the required group size from the game's tier
   *   2. While enough players remain, slice a candidate group
   *   3. Score the group via the injected strategy
   *   4. If the score meets the threshold, emit a MatchGroup and
   *      remove those players from the queue
   *   5. If the score is too low, skip this group (players stay queued
   *      for the next processing cycle)
   *
   * Returns all successfully formed MatchGroups for observability.
   *
   * @returns Array of MatchGroup payloads that were handed off.
   */
  processQueue(): MatchGroup[] {
    const formedGroups: MatchGroup[] = [];

    // Iterate over every game partition independently (hard partitioning)
    for (const [game, players] of this.queue.entries()) {
      const groupSize = getGroupSize(game);
      const tier      = getTier(game);

      // Keep forming groups while we have enough players
      while (players.length >= groupSize) {
        // Take the first `groupSize` players (FIFO — respects queue order)
        const candidates = players.slice(0, groupSize);

        // Delegate scoring to the injected strategy
        const score = this.strategy.scoreGroup(candidates);

        if (score >= this.scoreThreshold) {
          // ── Match accepted ────────────────────────────────────────────
          const matchGroup: MatchGroup = {
            groupId   : `grp_${crypto.randomUUID()}`,
            game,
            tier,
            userIds   : candidates.map((p) => p.userId),
            score,
            matchedAt : new Date().toISOString(),
          };

          // Remove matched players from the front of the queue
          players.splice(0, groupSize);

          // Fire the handoff callback (Lobby service hook point)
          this.onMatchFound(matchGroup);

          // Track for return value
          formedGroups.push(matchGroup);
        } else {
          // ── Match rejected ────────────────────────────────────────────
          // With the DummyStrategy (0.85 > 0.70), this branch is never
          // hit — but the plumbing is in place for the real scorer.
          // Break to avoid an infinite loop on the same failing group.
          console.log(
            `[Engine] Group for ${game} scored ${score.toFixed(2)} — ` +
            `below threshold ${this.scoreThreshold.toFixed(2)}. Skipping.`,
          );
          break;
        }
      }
    }

    return formedGroups;
  }

  // ── Observability helpers ────────────────────────────────────────────────

  /**
   * Returns a snapshot of the current queue sizes per game.
   * Useful for logging, dashboards, and health checks.
   */
  getQueueSnapshot(): Record<string, number> {
    const snapshot: Record<string, number> = {};
    for (const [game, players] of this.queue.entries()) {
      snapshot[game] = players.length;
    }
    return snapshot;
  }

  /**
   * Returns the total number of players across all game queues.
   */
  getTotalQueueSize(): number {
    let total = 0;
    for (const players of this.queue.values()) {
      total += players.length;
    }
    return total;
  }
}
