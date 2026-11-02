/**
 * @file time-decay-model.ts
 * @description Sub-issue 24.1 — Dynamic Time Decay Model
 *
 * Provides the mathematical model that dynamically lowers the match
 * acceptance threshold as a player waits in the queue. This prevents
 * indefinite waits while maintaining baseline match quality.
 *
 * The model uses an exponential decay function with a hard floor:
 *
 *   threshold(t) = max(FLOOR, FLOOR + (INITIAL - FLOOR) * e^(-k * t))
 *
 * Where:
 *   - t       = elapsed queue time in seconds
 *   - INITIAL = starting threshold (0.85)
 *   - FLOOR   = minimum acceptable threshold (0.30)
 *   - k       = decay rate constant (0.003367)
 *   - e       = Euler's number (~2.71828)
 *
 * Design principles:
 *   - Pure functions only (no side effects, no state)
 *   - All constants imported from time-decay.config.ts
 *   - Fully generic — works for any game/tier combination
 */

import {
  INITIAL_THRESHOLD,
  MINIMUM_THRESHOLD_FLOOR,
  MAX_WAIT_REFERENCE,
  TAIL_BLEND_START,
  DECAY_RATE_K,
} from './time-decay.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Core decay function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the dynamically adjusted match acceptance threshold based
 * on how long a player has been waiting in the queue.
 *
 * ## Mathematical Model
 *
 * The curve has two pieces:
 *
 * 1. Exponential decay from INITIAL down toward FLOOR:
 *
 * ```
 *   threshold(t) = FLOOR + (INITIAL - FLOOR) * e^(-k * t)
 * ```
 *
 * 2. A smoothstep tail blend over the final TAIL_BLEND_SECONDS
 *    (TAIL_BLEND_START → MAX_WAIT_REFERENCE) that lands exactly on FLOOR.
 *
 * The tail blend removes the discontinuity that a hard clamp at 300s would
 * create. At 270s the exponential value is ~0.522; over the next 30s it is
 * blended smoothly to 0.300 instead of jumping there instantly.
 *
 * ### Intuition
 *
 * The "decayable range" is (INITIAL - FLOOR) = 0.85 - 0.30 = 0.55.
 * The exponential term `e^(-k*t)` starts at 1.0 (when t=0) and
 * monotonically approaches 0.0 as t grows. So the threshold smoothly
 * slides from INITIAL down toward FLOOR.
 *
 * ### Reference Curve
 *
 * ```
 *   t =   0s  ->  0.850  (fresh — maximum strictness)
 *   t =  60s  ->  0.749  (mild relaxation)
 *   t = 120s  ->  0.667  (meaningful relaxation)
 *   t = 180s  ->  0.600  (design target: 3 min checkpoint)
 *   t = 240s  ->  0.545
 *   t = 270s  ->  0.522  (tail blend starts)
 *   t = 285s  ->  0.411  (mid-blend)
 *   t = 300s  ->  0.300  (floor reached continuously)
 * ```
 *
 * @param queueTime - Elapsed seconds the player has been waiting (>= 0).
 * @returns The acceptable match score threshold in [FLOOR, INITIAL].
 *
 * @example
 * getAcceptableThreshold(0);   // 0.85  (freshly queued)
 * getAcceptableThreshold(180); // 0.60  (waited 3 minutes)
 * getAcceptableThreshold(300); // 0.30  (floor — 5 minutes)
 * getAcceptableThreshold(999); // 0.30  (still floor)
 */
export function getAcceptableThreshold(queueTime: number): number {
  // Guard: negative queue times are treated as 0 (just entered)
  const t = Math.max(0, queueTime);

  // At or beyond the reference time, the floor is the final answer
  if (t >= MAX_WAIT_REFERENCE) {
    return MINIMUM_THRESHOLD_FLOOR;
  }

  const decayableRange = INITIAL_THRESHOLD - MINIMUM_THRESHOLD_FLOOR;

  // Exponential decay: FLOOR + decayableRange * e^(-k * t).
  // The clamp keeps t=0 exactly at INITIAL_THRESHOLD: 0.30 + 0.55 evaluates
  // to 0.8500000000000001 in IEEE-754, which would reject a score of 0.85.
  const exponential = Math.min(
    INITIAL_THRESHOLD,
    MINIMUM_THRESHOLD_FLOOR + decayableRange * Math.exp(-DECAY_RATE_K * t),
  );

  // Before the blend window, use the exponential curve directly
  if (t <= TAIL_BLEND_START) {
    return Math.max(MINIMUM_THRESHOLD_FLOOR, exponential);
  }

  // Smoothstep tail blend from the exponential value at TAIL_BLEND_START
  // down to the floor at MAX_WAIT_REFERENCE.
  const blendStartValue =
    MINIMUM_THRESHOLD_FLOOR +
    decayableRange * Math.exp(-DECAY_RATE_K * TAIL_BLEND_START);
  const progress =
    (t - TAIL_BLEND_START) / (MAX_WAIT_REFERENCE - TAIL_BLEND_START);
  const smoothProgress = progress * progress * (3 - 2 * progress);

  return (
    blendStartValue +
    (MINIMUM_THRESHOLD_FLOOR - blendStartValue) * smoothProgress
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group threshold resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the acceptable threshold for a group of players, each with
 * a different queueTime.
 *
 * ## Strategy: Longest-Waiting Player Wins
 *
 * We use the MAXIMUM queueTime in the group to compute the threshold.
 * This prioritises getting the longest-waiting player into a game, even
 * if it means slightly relaxing the bar for players who just joined.
 *
 * ### Rationale
 *
 * If we used the average or minimum queueTime, a long-waiting player
 * could be perpetually blocked by freshly-queued players who keep
 * raising the threshold. Using the max ensures fairness: the player
 * who has waited the most drives the urgency.
 *
 * ### Example
 *
 * Group of 5 with queueTimes [10, 25, 45, 120, 200]:
 *   - Max queueTime = 200s
 *   - threshold(200) = 0.30 + 0.55 * e^(-0.003367 * 200)
 *                    = 0.30 + 0.55 * 0.5104
 *                    = 0.581
 *
 * The group needs a score >= 0.581 to be accepted.
 *
 * @param queueTimes - Array of queueTime values (one per player in the group).
 * @returns The threshold derived from the longest-waiting player.
 * @throws If the array is empty.
 *
 * @example
 * resolveGroupThreshold([10, 25, 45, 120, 200]); // ~0.581
 * resolveGroupThreshold([300, 300, 300, 300, 300]); // 0.30 (all at floor)
 */
export function resolveGroupThreshold(
  queueTimes: ReadonlyArray<number>,
): number {
  if (queueTimes.length === 0) {
    throw new Error(
      '[CampusGG] resolveGroupThreshold called with empty array.',
    );
  }

  // The longest-waiting player sets the urgency
  const maxQueueTime = Math.max(...queueTimes);

  return getAcceptableThreshold(maxQueueTime);
}
