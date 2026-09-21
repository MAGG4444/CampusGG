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
 * Uses shifted exponential decay with a hard floor:
 *
 * ```
 *   threshold(t) = FLOOR + (INITIAL - FLOOR) * e^(-k * t)
 * ```
 *
 * ### Intuition
 *
 * The "decayable range" is (INITIAL - FLOOR) = 0.85 - 0.30 = 0.55.
 * The exponential term `e^(-k*t)` starts at 1.0 (when t=0) and
 * monotonically approaches 0.0 as t grows. So the threshold smoothly
 * slides from INITIAL down toward FLOOR.
 *
 * ### Decay Rate Derivation
 *
 * The rate constant k = 0.003367 was derived from the design constraint:
 *
 * ```
 *   threshold(180s) = 0.60
 *   0.30 + 0.55 * e^(-k * 180) = 0.60
 *   e^(-k * 180) = (0.60 - 0.30) / 0.55 = 0.5454...
 *   -k * 180 = ln(0.5454) = -0.6061
 *   k = 0.6061 / 180 = 0.003367
 * ```
 *
 * ### Hard Floor Clamp
 *
 * For queue times at or beyond MAX_WAIT_REFERENCE (300s), the threshold
 * is hard-clamped to MINIMUM_THRESHOLD_FLOOR (0.30). This prevents the
 * exponential tail from dragging the threshold below the safety floor.
 *
 * ### Reference Curve
 *
 * ```
 *   t =   0s  ->  0.850  (fresh — maximum strictness)
 *   t =  30s  ->  0.797  (barely relaxed)
 *   t =  60s  ->  0.749  (mild relaxation)
 *   t =  90s  ->  0.704  (noticeable)
 *   t = 120s  ->  0.663  (meaningful relaxation)
 *   t = 150s  ->  0.626  (past 2 min — getting flexible)
 *   t = 180s  ->  0.600  (design target: 3 min checkpoint)
 *   t = 210s  ->  0.566
 *   t = 240s  ->  0.541
 *   t = 270s  ->  0.519
 *   t = 300s  ->  0.300  (hard clamp — floor reached)
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

  // Hard clamp: at or beyond the reference time, snap to floor
  if (t >= MAX_WAIT_REFERENCE) {
    return MINIMUM_THRESHOLD_FLOOR;
  }

  // Exponential decay: FLOOR + decayableRange * e^(-k * t)
  const decayableRange = INITIAL_THRESHOLD - MINIMUM_THRESHOLD_FLOOR;
  const decay = Math.exp(-DECAY_RATE_K * t);
  const threshold = MINIMUM_THRESHOLD_FLOOR + decayableRange * decay;

  // Defensive clamp (should never be needed with valid config, but safe)
  return Math.max(MINIMUM_THRESHOLD_FLOOR, threshold);
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
export function resolveGroupThreshold(queueTimes: ReadonlyArray<number>): number {
  if (queueTimes.length === 0) {
    throw new Error('[CampusGG] resolveGroupThreshold called with empty array.');
  }

  // The longest-waiting player sets the urgency
  const maxQueueTime = Math.max(...queueTimes);

  return getAcceptableThreshold(maxQueueTime);
}
