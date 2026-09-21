/**
 * @file time-decay.config.ts
 * @description Sub-issue 24.1 — Time Decay Configuration
 *
 * Central configuration for the dynamic threshold decay curve.
 * All constants that shape the "how quickly do we relax match quality
 * as a player waits?" behaviour live HERE and nowhere else.
 *
 * Tuning guide:
 *   - Raise INITIAL_THRESHOLD to start stricter (longer initial wait).
 *   - Lower MINIMUM_THRESHOLD_FLOOR to accept worse matches under pressure.
 *   - Lower MAX_WAIT_REFERENCE to reach the floor faster.
 *   - Increase DECAY_RATE_K to make the curve steeper (faster relaxation).
 *
 * Follows Single Responsibility: config owns data, the model owns math.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Threshold bounds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The threshold the engine starts at when a player first enters the queue.
 * At queueTime = 0 seconds, only very high-quality matches (>= 0.85) are accepted.
 * This ensures fresh players get the best possible teammates.
 */
export const INITIAL_THRESHOLD = 0.85;

/**
 * The absolute minimum threshold the decay curve will ever reach.
 * No matter how long a player waits, the engine will never accept a match
 * scoring below this floor. This prevents degenerate pairings.
 *
 * 0.30 means: even after 5+ minutes of waiting, we still require at least
 * 30% compatibility — some baseline skill/intensity alignment.
 */
export const MINIMUM_THRESHOLD_FLOOR = 0.30;

// ─────────────────────────────────────────────────────────────────────────────
// Timing constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The reference time (in seconds) at which the threshold should have
 * approximately reached the floor.
 *
 * 300 seconds = 5 minutes. This is the CampusGG design target for
 * "maximum reasonable wait" in a collegiate gaming context.
 * After this point, the threshold flatlines at MINIMUM_THRESHOLD_FLOOR.
 */
export const MAX_WAIT_REFERENCE = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Decay curve shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exponential decay rate constant (k).
 *
 * Derived from the constraint:
 *   At t = MAX_WAIT_REFERENCE (300s), the threshold should be
 *   approximately at the floor.
 *
 * Using the exponential decay formula:
 *   threshold(t) = floor + (initial - floor) * e^(-k * t)
 *
 * We want threshold(300) to be very close to the floor.
 * Setting e^(-k * 300) = 0.01 (1% of the decayable range remaining):
 *   -k * 300 = ln(0.01)
 *   k = -ln(0.01) / 300
 *   k = 4.60517 / 300
 *   k ≈ 0.01535
 *
 * This gives a smooth curve where:
 *   - At 0s   : 0.85 (full strictness)
 *   - At 60s  : ~0.63 (meaningful relaxation after 1 min)
 *   - At 120s : ~0.47 (halfway relaxed)
 *   - At 180s : ~0.38 (approaching floor at 3 min)
 *   - At 300s : ~0.31 (practically at floor)
 *
 * Wait, let me recalculate to hit the ~0.60 target at 180s as specified:
 *   threshold(180) = 0.30 + 0.55 * e^(-k*180) = 0.60
 *   0.55 * e^(-k*180) = 0.30
 *   e^(-k*180) = 0.30 / 0.55 = 0.54545
 *   -k*180 = ln(0.54545) = -0.60614
 *   k = 0.60614 / 180 = 0.003367
 *
 * That's too slow. Let's solve properly for a nice curve:
 *   k = 0.008 gives us:
 *   - At 180s: 0.30 + 0.55 * e^(-0.008*180) = 0.30 + 0.55 * 0.237 = 0.43
 *
 *   k = 0.005 gives us:
 *   - At 180s: 0.30 + 0.55 * e^(-0.005*180) = 0.30 + 0.55 * 0.407 = 0.524
 *
 *   k = 0.003367 gives us:
 *   - At 180s: 0.30 + 0.55 * e^(-0.003367*180) = 0.30 + 0.55 * 0.546 = 0.60
 *   - At 300s: 0.30 + 0.55 * e^(-0.003367*300) = 0.30 + 0.55 * 0.364 = 0.50
 *     (still too high at 300s)
 *
 * So the user's targets require a NON-exponential curve, or we use a
 * steeper rate. Let's pick k that best balances both targets:
 *
 * Compromise: k = 0.008
 *   - At 0s  : 0.85
 *   - At 60s : 0.73
 *   - At 120s: 0.63
 *   - At 180s: 0.56 (~0.60 acceptable)
 *   - At 240s: 0.50
 *   - At 300s: 0.43
 *   - Floor kicks in via clamp for >= 300s
 *
 * Actually the user said "At 300s it flatlines at 0.30" meaning we
 * hard-clamp to the floor AT that point. So we use the exponential
 * down to 300s and then hard-clamp. The k value is tuned so the
 * curve arrives near the floor by 300s.
 *
 * Final decision: k = 0.01 (clean number, good curve):
 *   - At 0s  : 0.850
 *   - At 60s : 0.599  (close to user's 0.60 target at 180s... hmm)
 *   - At 180s: 0.391
 *   - At 300s: 0.327  (very close to floor)
 *
 * But user wants ~0.60 at 180s, not 60s. Let's use k = 0.003367
 * and hard-clamp at MAX_WAIT_REFERENCE:
 *   - At 0s  : 0.850
 *   - At 60s : 0.745
 *   - At 120s: 0.654
 *   - At 180s: 0.600  (exact target!)
 *   - At 240s: 0.550
 *   - At 300s: >= floor, clamp to 0.300
 */
export const DECAY_RATE_K = 0.003367;
