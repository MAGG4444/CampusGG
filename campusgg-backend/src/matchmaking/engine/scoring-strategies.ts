/**
 * @file scoring-strategies.ts
 * @description Sub-issue 23.3 — Real Scoring Strategies
 *
 * Contains the production-ready MatchStrategy implementations:
 *
 *   - CasualScoringStrategy   : trivial pass-through for 2-player co-op
 *   - CompetitiveScoringStrategy : multi-dimensional weighted scorer for
 *     ALL 5v5 competitive games (CS2, Valorant, LOL, Dota, OW2, etc.)
 *
 * The CompetitiveScoringStrategy is purely generic — it never references
 * game-specific role names like "IGL" or "Mid". It operates on:
 *   - stats.rating          (numeric skill metric)
 *   - intensity             (float [0,1])
 *   - profile.universityDomain / profile.major (string comparisons)
 *   - preferences.primaryRole (unique-string counting for role diversity)
 *
 * All tunable parameters are imported from scoring.config.ts.
 *
 * Design principles:
 *   - Open/Closed      : new games require zero changes here
 *   - Single Responsibility : each strategy owns one tier's logic
 *   - Liskov Substitution : both strategies are drop-in MatchStrategy impls
 */

import type { PlayerMatchmakingInput } from '../schemas/player-matchmaking.schema.js';
import type { MatchStrategy } from './match-strategy.interface.js';

import {
  SKILL_WEIGHT,
  INTENT_WEIGHT,
  PROFILE_WEIGHT,
  PERFECT_RATING_DELTA,
  MAX_RATING_PENALTY_DELTA,
  SKILL_FLOOR,
  PERFECT_INTENSITY_DELTA,
  MAX_INTENSITY_PENALTY_DELTA,
  SAME_MAJOR_PAIR_BONUS,
  MAX_ROLE_SYNERGY_MULTIPLIER,
} from './scoring.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper functions (stateless, testable in isolation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the numeric skill rating from a player's stats block.
 *
 * Currently all game stat interfaces have a `rating` field.
 * If a future game uses a different metric name, extend this function
 * with a switch on `stats.game` — the rest of the strategy stays untouched.
 *
 * @param player - The player to extract the rating from.
 * @returns The numeric rating value.
 */
function extractRating(player: PlayerMatchmakingInput): number {
  // Generic access — works for CS2Stats and any future stats interface
  // that follows the { rating: number } convention.
  return (player.stats as { rating: number }).rating;
}

/**
 * Linearly interpolates a value between two endpoints.
 *
 * When `value` is at or below `start`, returns `scoreAtStart`.
 * When `value` is at or above `end`, returns `scoreAtEnd`.
 * Between the two, linearly blends.
 *
 * @param value        - The input value to map.
 * @param start        - The input value where the output equals scoreAtStart.
 * @param end          - The input value where the output equals scoreAtEnd.
 * @param scoreAtStart - The output score at `start`.
 * @param scoreAtEnd   - The output score at `end`.
 * @returns A linearly interpolated score clamped to [min(scoreAtStart, scoreAtEnd), max(scoreAtStart, scoreAtEnd)].
 */
function linearDecay(
  value: number,
  start: number,
  end: number,
  scoreAtStart: number,
  scoreAtEnd: number,
): number {
  if (value <= start) return scoreAtStart;
  if (value >= end) return scoreAtEnd;
  const t = (value - start) / (end - start);
  return scoreAtStart + t * (scoreAtEnd - scoreAtStart);
}

/**
 * Counts the number of distinct pairs sharing the same value in an array.
 *
 * For example, ['CS', 'CS', 'EE', 'CS'] has C(3,2)=3 pairs for 'CS'
 * and C(1,2)=0 for 'EE', yielding 3 total matching pairs.
 *
 * Uses the frequency formula: for each value with frequency f,
 * the number of pairs is f*(f-1)/2.
 *
 * @param values - Array of string values to count pairs in.
 * @returns Total number of same-value pairs.
 */
function countMatchingPairs(values: ReadonlyArray<string>): number {
  const freq = new Map<string, number>();
  for (const v of values) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  let pairs = 0;
  for (const f of freq.values()) {
    pairs += (f * (f - 1)) / 2;
  }
  return pairs;
}

// ─────────────────────────────────────────────────────────────────────────────
// W1: Skill Cohesion sub-scorer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates how tightly clustered the players' skill ratings are.
 *
 * Formula:
 *   delta = max(ratings) - min(ratings)
 *   if delta <= PERFECT_RATING_DELTA (500)  → 1.0  (perfect cohesion)
 *   if delta >= MAX_RATING_PENALTY_DELTA (2000) → SKILL_FLOOR (0.2)
 *   otherwise → linear decay from 1.0 to 0.2
 *
 * @param group - Candidate group of players.
 * @returns Skill cohesion sub-score in [SKILL_FLOOR, 1.0].
 */
function scoreSkillCohesion(group: ReadonlyArray<PlayerMatchmakingInput>): number {
  const ratings = group.map(extractRating);
  const delta = Math.max(...ratings) - Math.min(...ratings);
  return linearDecay(delta, PERFECT_RATING_DELTA, MAX_RATING_PENALTY_DELTA, 1.0, SKILL_FLOOR);
}

// ─────────────────────────────────────────────────────────────────────────────
// W2: Intensity Alignment sub-scorer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates how closely the players' competitive intensity levels match.
 *
 * Formula:
 *   delta = max(intensities) - min(intensities)
 *   if delta <= PERFECT_INTENSITY_DELTA (0.2) → 1.0  (well-aligned)
 *   if delta >= MAX_INTENSITY_PENALTY_DELTA (1.0) → 0.0  (full mismatch)
 *   otherwise → linear decay from 1.0 to 0.0
 *
 * This is the primary toxicity-prevention scoring dimension:
 * mismatched intensity is the #1 predictor of in-game friction.
 *
 * @param group - Candidate group of players.
 * @returns Intensity alignment sub-score in [0.0, 1.0].
 */
function scoreIntensityAlignment(group: ReadonlyArray<PlayerMatchmakingInput>): number {
  const intensities = group.map((p) => p.intensity);
  const delta = Math.max(...intensities) - Math.min(...intensities);
  return linearDecay(delta, PERFECT_INTENSITY_DELTA, MAX_INTENSITY_PENALTY_DELTA, 1.0, 0.0);
}

// ─────────────────────────────────────────────────────────────────────────────
// W3: Profile Affinity sub-scorer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates collegiate community affinity based on two signals:
 *
 *   1. University overlap: base score = (highest frequency of any single
 *      universityDomain) / (group size). A full same-university stack → 1.0.
 *
 *   2. Major overlap: +SAME_MAJOR_PAIR_BONUS (0.1) per distinct pair of
 *      players sharing the same academic major. Additive, capped at 1.0.
 *
 * Example (5 players):
 *   3 from purdue.edu, 2 from illinois.edu → base = 3/5 = 0.60
 *   2 share "Computer Science" → +0.1 → 0.70
 *   Final (before cap) = 0.70
 *
 * @param group - Candidate group of players.
 * @returns Profile affinity sub-score in [0.0, 1.0].
 */
function scoreProfileAffinity(group: ReadonlyArray<PlayerMatchmakingInput>): number {
  const groupSize = group.length;

  // ── University overlap ──────────────────────────────────────────────────
  const domainFreq = new Map<string, number>();
  for (const p of group) {
    const d = p.profile.universityDomain;
    domainFreq.set(d, (domainFreq.get(d) ?? 0) + 1);
  }
  const maxDomainFreq = Math.max(...domainFreq.values());
  const baseScore = maxDomainFreq / groupSize;

  // ── Major overlap (pair counting) ───────────────────────────────────────
  const majors = group.map((p) => p.profile.major);
  const majorPairs = countMatchingPairs(majors);
  const majorBonus = majorPairs * SAME_MAJOR_PAIR_BONUS;

  return Math.min(1.0, baseScore + majorBonus);
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Synergy multiplier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a role diversity multiplier based on how many unique primary
 * roles exist in the group.
 *
 * This is GAME-AGNOSTIC — it counts distinct string values, not specific
 * role names. Works identically for CS2 roles ("IGL", "AWPer"), LOL roles
 * ("Top", "Mid"), or any future game.
 *
 * Mapping:
 *   5 unique roles → MAX_ROLE_SYNERGY_MULTIPLIER (1.10)
 *   4 unique roles → 1.05  (midpoint between 1.0 and max)
 *   3 or fewer     → 1.00  (no bonus — significant role conflict)
 *
 * @param group - Candidate group of players.
 * @returns A multiplier in [1.0, MAX_ROLE_SYNERGY_MULTIPLIER].
 */
function computeRoleSynergyMultiplier(group: ReadonlyArray<PlayerMatchmakingInput>): number {
  const uniqueRoles = new Set(group.map((p) => p.preferences.primaryRole));
  const uniqueCount = uniqueRoles.size;

  if (uniqueCount >= 5) return MAX_ROLE_SYNERGY_MULTIPLIER;  // 1.10
  if (uniqueCount === 4) return 1.0 + (MAX_ROLE_SYNERGY_MULTIPLIER - 1.0) / 2; // 1.05
  return 1.0; // 3 or fewer — no bonus
}

// ═════════════════════════════════════════════════════════════════════════════
// Strategy implementations
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Scoring strategy for Casual-tier games (2-player co-op / social).
 *
 * Casual matches have minimal compatibility requirements — the main goal
 * is fast queue times, not optimal team composition. As long as the group
 * size is valid (≥ 1), the match is accepted.
 *
 * Returns 1.0 unconditionally (always passes any threshold).
 */
export class CasualScoringStrategy implements MatchStrategy {
  /**
   * @param group - The candidate pair of players.
   * @returns 1.0 if group is non-empty, 0.0 otherwise.
   */
  scoreGroup(group: ReadonlyArray<PlayerMatchmakingInput>): number {
    return group.length > 0 ? 1.0 : 0.0;
  }
}

/**
 * Scoring strategy for Competitive-tier games (5v5 team-based).
 *
 * Produces a single compatibility score in [0.0, 1.0] by evaluating
 * three weighted dimensions and applying a role-diversity multiplier:
 *
 *   finalScore = min(1.0, (W1×Skill + W2×Intent + W3×Profile) × RoleMultiplier)
 *
 * All sub-scorers are game-agnostic — they operate on generic numeric
 * fields (rating, intensity) and string comparisons (roles, domains, majors).
 * No game-specific strings like "IGL", "AWPer", or "Mid" appear here.
 *
 * Dimension breakdown:
 *   W1 (30%) — Skill Cohesion     : rating spread within the group
 *   W2 (30%) — Intensity Alignment: intensity spread (toxicity prevention)
 *   W3 (40%) — Profile Affinity   : university + major overlap
 *   ×  Role Synergy Multiplier    : bonus for diverse primaryRole selection
 */
export class CompetitiveScoringStrategy implements MatchStrategy {
  /**
   * Score a candidate group of competitive players.
   *
   * @param group - Exactly 5 players (enforced by the engine, not here).
   * @returns A compatibility score in [0.0, 1.0].
   */
  scoreGroup(group: ReadonlyArray<PlayerMatchmakingInput>): number {
    // ── Compute the three weighted sub-scores ───────────────────────────
    const skillScore     = scoreSkillCohesion(group);
    const intensityScore = scoreIntensityAlignment(group);
    const profileScore   = scoreProfileAffinity(group);

    // ── Weighted sum ────────────────────────────────────────────────────
    const weightedSum =
      SKILL_WEIGHT   * skillScore +
      INTENT_WEIGHT  * intensityScore +
      PROFILE_WEIGHT * profileScore;

    // ── Apply role synergy multiplier ───────────────────────────────────
    const roleMultiplier = computeRoleSynergyMultiplier(group);

    // ── Final score, capped at 1.0 ─────────────────────────────────────
    return Math.min(1.0, weightedSum * roleMultiplier);
  }
}
