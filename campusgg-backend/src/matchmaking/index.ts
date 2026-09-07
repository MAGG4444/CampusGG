/**
 * @file index.ts  (matchmaking module barrel)
 * @description Public API surface for the matchmaking module.
 *
 * Consumers (engine, controllers, tests) should import from this barrel:
 *
 *   import type { PlayerMatchmakingInput } from '../matchmaking';
 *   import { MatchmakingEngine, DummyStrategy } from '../matchmaking';
 *
 * This keeps internal folder structure an implementation detail.
 */

// ── 23.1: Schema — types and interfaces (engine interface contract) ─────────
export type {
  SupportedGame,
  CS2Role,
  ActiveSchedule,
  UniversityDomain,
  PlayerProfile,
  CS2Stats,
  GameStats,
  PlayerPreferences,
  PlayerMatchmakingInput,
} from './schemas/player-matchmaking.schema.js';

export type { MatchGroup } from './schemas/match-group.schema.js';

// ── 23.2: Engine — core loop, strategy, tiers ──────────────────────────────
export type { GameTier } from './engine/game-tiers.config.js';
export { GAME_TIER_MAP, TIER_GROUP_SIZE, getTier, getGroupSize } from './engine/game-tiers.config.js';

export type { MatchStrategy } from './engine/match-strategy.interface.js';
export { DummyStrategy } from './engine/match-strategy.interface.js';

export type { OnMatchFoundCallback, MatchmakingEngineOptions } from './engine/matchmaking-engine.js';
export { MatchmakingEngine } from './engine/matchmaking-engine.js';

// ── Mock generator — dev/test utility, NOT imported in production bundles ───
export { generateMockPlayers } from './mock/mock-player.generator.js';
