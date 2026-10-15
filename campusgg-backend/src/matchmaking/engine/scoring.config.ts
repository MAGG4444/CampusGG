/**
 * @file scoring.config.ts
 * @description Sub-issue 23.3 — Scoring Configuration
 *
 * Central configuration for all scoring weights, thresholds, and multipliers
 * used by the matchmaking strategies. Every magic number lives HERE and
 * nowhere else — strategies import from this file instead of hard-coding.
 *
 * Tuning guide:
 *   - Increase SKILL_WEIGHT to make rating similarity more decisive.
 *   - Increase INTENT_WEIGHT to prioritise toxicity-prevention (intensity).
 *   - Increase PROFILE_WEIGHT to favour same-university / same-major pairing.
 *   - Lower PERFECT_RATING_DELTA to tighten the "perfect" skill bracket.
 *   - Raise MAX_ROLE_SYNERGY_MULTIPLIER to reward diverse team compositions.
 *
 * Follows Single Responsibility: config owns data, strategies own logic.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Dimension weights (must sum to 1.0)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weight for the Skill Cohesion dimension.
 * Measures how close the players' ratings are to one another.
 */
export const SKILL_WEIGHT = 0.3;

/**
 * Weight for the Intensity Alignment dimension.
 * Measures how similar the players' competitive intensity preferences are.
 * Primary toxicity-prevention signal.
 */
export const INTENT_WEIGHT = 0.3;

/**
 * Weight for the Profile Affinity dimension.
 * Measures university overlap and academic major similarity.
 * Collegiate identity is a core differentiator for CampusGG.
 */
export const PROFILE_WEIGHT = 0.4;

// ─────────────────────────────────────────────────────────────────────────────
// Skill Cohesion thresholds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum rating spread (max − min) considered "perfect".
 * If the spread is within this delta, the skill sub-score is 1.0.
 *
 * 500 rating points ≈ one sub-rank in CS2 Premier.
 */
export const PERFECT_RATING_DELTA = 500;

/**
 * Rating spread at which the skill sub-score floors out.
 * Beyond this delta, skill cohesion score is clamped to SKILL_FLOOR.
 *
 * 2000 rating points ≈ a full rank gap — unacceptable for competitive play.
 */
export const MAX_RATING_PENALTY_DELTA = 2000;

/**
 * The lowest possible skill sub-score when the rating spread
 * exceeds MAX_RATING_PENALTY_DELTA.
 */
export const SKILL_FLOOR = 0.2;

// ─────────────────────────────────────────────────────────────────────────────
// Intensity Alignment thresholds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum intensity spread (max − min) considered "perfect".
 * A spread of 0.2 means a casual-leaning player matched with a
 * slightly-above-casual player — acceptable tolerance.
 */
export const PERFECT_INTENSITY_DELTA = 0.2;

/**
 * Intensity spread at which the sub-score reaches 0.0.
 * A spread of 1.0 means a full casual (0.0) paired with a full try-hard (1.0).
 */
export const MAX_INTENSITY_PENALTY_DELTA = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// Profile Affinity bonuses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Micro-bonus added to the profile affinity sub-score for each
 * distinct pair of players sharing the same academic major.
 *
 * With 5 players, a maximum of C(5,2) = 10 pairs exist.
 * The bonus is additive and the total is capped at 1.0.
 */
export const SAME_MAJOR_PAIR_BONUS = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// Role Synergy multiplier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multiplier applied when ALL players have distinct primary roles.
 * 5 unique roles → 1.10 (maximum synergy bonus)
 * 4 unique roles → 1.05 (partial diversity)
 * 3 or fewer     → 1.00 (no bonus — role conflict exists)
 *
 * This is GAME-AGNOSTIC: it counts unique strings, not specific role names.
 */
export const MAX_ROLE_SYNERGY_MULTIPLIER = 1.1;
