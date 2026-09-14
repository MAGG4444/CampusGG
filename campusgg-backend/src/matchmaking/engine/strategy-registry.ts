/**
 * @file strategy-registry.ts
 * @description Sub-issue 23.3 — Strategy Registry (Factory)
 *
 * Provides a single entry point for obtaining the correct MatchStrategy
 * implementation for any supported game. The engine and run scripts call
 * `getScoringStrategy(game)` instead of constructing strategies directly.
 *
 * This decouples strategy selection from strategy construction — adding
 * a new game or switching a game's tier only requires editing the tier
 * map (game-tiers.config.ts), not this registry.
 *
 * Follows:
 *   - Factory Pattern    : centralised creation of strategy instances
 *   - Open/Closed        : new tiers = new branch here, no caller changes
 *   - Dependency Inversion: callers depend on MatchStrategy, not concrete classes
 */

import type { SupportedGame } from '../schemas/player-matchmaking.schema.js';
import type { MatchStrategy } from './match-strategy.interface.js';
import { getTier } from './game-tiers.config.js';
import { CasualScoringStrategy, CompetitiveScoringStrategy } from './scoring-strategies.js';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instances (stateless — safe to reuse)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reusable strategy instances.
 * Both strategies are stateless (no mutable fields), so a single instance
 * per tier is sufficient — no need for per-call instantiation.
 */
const COMPETITIVE_STRATEGY = new CompetitiveScoringStrategy();
const CASUAL_STRATEGY      = new CasualScoringStrategy();

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the appropriate MatchStrategy for the given game.
 *
 * Routing logic:
 *   - Competitive tier → CompetitiveScoringStrategy (multi-dimensional scorer)
 *   - Casual tier      → CasualScoringStrategy      (always-pass scorer)
 *
 * @param game - The game title to look up.
 * @returns The MatchStrategy instance for that game's tier.
 * @throws If the game is not in GAME_TIER_MAP (via getTier).
 *
 * @example
 * const strategy = getScoringStrategy('CS2');       // CompetitiveScoringStrategy
 * const strategy = getScoringStrategy('It Takes Two'); // CasualScoringStrategy
 */
export function getScoringStrategy(game: SupportedGame): MatchStrategy {
  const tier = getTier(game);

  switch (tier) {
    case 'Competitive':
      return COMPETITIVE_STRATEGY;
    case 'Casual':
      return CASUAL_STRATEGY;
    default: {
      // Exhaustiveness guard — TypeScript will error if a new tier is added
      // to GameTier but not handled here.
      const _exhaustive: never = tier;
      throw new Error(`[CampusGG] Unhandled tier: "${_exhaustive}". Update strategy-registry.ts.`);
    }
  }
}
