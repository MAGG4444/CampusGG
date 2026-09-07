/**
 * @file match-strategy.interface.ts
 * @description Sub-issue 23.2 — Strategy Pattern Interface
 *
 * Defines the contract that all scoring strategies must implement.
 * The engine is strategy-agnostic: it only calls `scoreGroup()` and
 * compares the result against a configurable threshold.
 *
 * For 23.2, a DummyStrategy is provided so the engine loop can be
 * tested end-to-end before the real multi-dimensional scorer (23.3)
 * is implemented.
 *
 * Follows:
 *   - Strategy Pattern   : engine delegates scoring to an injected strategy
 *   - Dependency Inversion: engine depends on the abstraction, not the impl
 *   - Interface Segregation: one method, one responsibility
 */

import type { PlayerMatchmakingInput } from '../schemas/player-matchmaking.schema.js';

// ─────────────────────────────────────────────────────────────────────────────
// Strategy interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contract for a matchmaking scoring strategy.
 *
 * Implementors receive a candidate group of players and return a single
 * compatibility score in [0.0, 1.0]. The engine then decides whether
 * the score meets the acceptance threshold.
 *
 * @example
 * class RealStrategy implements MatchStrategy {
 *   scoreGroup(group: ReadonlyArray<PlayerMatchmakingInput>): number {
 *     // multi-dimensional weighted scoring math here
 *   }
 * }
 */
export interface MatchStrategy {
  /**
   * Evaluate how well a candidate group of players fits together.
   *
   * @param group - The candidate group (2 or 5 players, depending on tier).
   * @returns     - A score in [0.0, 1.0] where 1.0 is a perfect match.
   */
  scoreGroup(group: ReadonlyArray<PlayerMatchmakingInput>): number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dummy implementation (23.2 placeholder)
// ─────────────────────────────────────────────────────────────────────────────

/** Default score returned by the dummy strategy. */
const DUMMY_SCORE = 0.85;

/**
 * A no-op strategy that always returns a fixed score (0.85).
 *
 * Purpose:
 *   - Lets us test the full engine loop (enqueue → partition → group → handoff)
 *     without waiting for the real scoring math.
 *   - The 0.85 value is above any reasonable threshold, so every candidate
 *     group will pass — proving the routing and grouping logic works.
 *
 * Will be replaced by the real scorer in Sub-issue 23.3.
 */
export class DummyStrategy implements MatchStrategy {
  /**
   * Always returns DUMMY_SCORE (0.85), regardless of group composition.
   * @param _group - Unused; present to satisfy the interface contract.
   */
  scoreGroup(_group: ReadonlyArray<PlayerMatchmakingInput>): number {
    return DUMMY_SCORE;
  }
}
