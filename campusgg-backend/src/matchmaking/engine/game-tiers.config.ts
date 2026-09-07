/**
 * @file game-tiers.config.ts
 * @description Sub-issue 23.2 — Game Tier Classification
 *
 * Maps every supported game to a tier that determines the required
 * group size for matchmaking. This is the single source of truth for
 * "how many players make a match" — the engine consults this config
 * instead of hard-coding sizes.
 *
 * To add a new game:
 *   1. Add the title to `SupportedGame` in player-matchmaking.schema.ts
 *   2. Add an entry to `GAME_TIER_MAP` below
 *   3. Done — the engine will auto-route to the correct group size
 *
 * Follows Open/Closed principle: extend by adding data, not by modifying
 * engine control flow.
 */

import type { SupportedGame } from '../schemas/player-matchmaking.schema.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tier definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two structural tiers on CampusGG.
 *
 * - `Competitive` : team-based ranked games (5-player groups)
 * - `Casual`      : co-op / social games   (2-player groups)
 */
export type GameTier = 'Competitive' | 'Casual';

/**
 * Maps each tier to its required group size.
 * This is the only place group sizes are defined.
 */
export const TIER_GROUP_SIZE: Readonly<Record<GameTier, number>> = {
  Competitive: 5,
  Casual: 2,
} as const;

/**
 * Maps every supported game to its tier.
 * If a game is not in this map, the engine will reject it at enqueue time.
 */
export const GAME_TIER_MAP: Readonly<Record<SupportedGame, GameTier>> = {
  'CS2':               'Competitive',
  'Valorant':          'Competitive',
  'League of Legends': 'Competitive',
  'Dota':              'Competitive',
  'OW2':               'Competitive',
  'Rocket League':     'Competitive',
  'It Takes Two':      'Casual',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the tier for a given game.
 * Throws if the game is unknown (should never happen with strict typing).
 */
export function getTier(game: SupportedGame): GameTier {
  const tier = GAME_TIER_MAP[game];
  if (!tier) {
    throw new Error(`[CampusGG] Unknown game: "${game}". Add it to GAME_TIER_MAP.`);
  }
  return tier;
}

/**
 * Returns the required number of players for a match in the given game.
 * This is the value the engine loop checks against the candidate pool size.
 */
export function getGroupSize(game: SupportedGame): number {
  return TIER_GROUP_SIZE[getTier(game)];
}
