/**
 * @file time-decay.config.ts
 * @description Sub-issue 24.1 — Time Decay Configuration
 *
 * Central configuration for the dynamic threshold decay curve.
 * All constants that shape the "how quickly do we relax match quality
 * as a player waits?" behaviour live HERE and nowhere else.
 *
 * The curve is an exponential decay from INITIAL_THRESHOLD towards
 * MINIMUM_THRESHOLD_FLOOR. A short smooth tail blend is applied over the
 * final TAIL_BLEND_SECONDS so the curve reaches the floor continuously
 * instead of jumping when MAX_WAIT_REFERENCE is reached.
 *
 * Reference curve:
 *   t =   0s -> 0.850
 *   t =  60s -> 0.749
 *   t = 120s -> 0.667
 *   t = 180s -> 0.600
 *   t = 240s -> 0.545
 *   t = 270s -> 0.522  (tail blend starts)
 *   t = 300s -> 0.300  (floor, reached continuously)
 *
 * Tuning guide:
 *   - Raise INITIAL_THRESHOLD to start stricter (longer initial wait).
 *   - Lower MINIMUM_THRESHOLD_FLOOR to accept worse matches under pressure.
 *   - Lower MAX_WAIT_REFERENCE to reach the floor faster.
 *   - Increase DECAY_RATE_K to make the curve steeper (faster relaxation).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Threshold bounds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The threshold the engine starts at when a player first enters the queue.
 * At queueTime = 0 seconds, only very high-quality matches (>= 0.85) are
 * accepted. This ensures fresh players get the best possible teammates.
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
export const MINIMUM_THRESHOLD_FLOOR = 0.3;

// ─────────────────────────────────────────────────────────────────────────────
// Timing constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The reference time (in seconds) at which the threshold reaches the floor.
 *
 * 300 seconds = 5 minutes. This is the CampusGG design target for
 * "maximum reasonable wait" in a collegiate gaming context.
 */
export const MAX_WAIT_REFERENCE = 300;

/**
 * Time (in seconds) at which the exponential curve hands over to the
 * smooth tail blend. From here to MAX_WAIT_REFERENCE the threshold is
 * interpolated to the floor with a smoothstep curve, eliminating the
 * discontinuity that a hard clamp would create.
 */
export const TAIL_BLEND_START = 270;

// ─────────────────────────────────────────────────────────────────────────────
// Decay curve shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exponential decay rate constant (k).
 *
 * Derived from the design target:
 *   threshold(180) = 0.60
 *   0.30 + 0.55 * e^(-k * 180) = 0.60
 *   e^(-k * 180) = 0.30 / 0.55
 *   k = -ln(0.30 / 0.55) / 180
 *   k ≈ 0.003367
 */
export const DECAY_RATE_K = 0.003367;
