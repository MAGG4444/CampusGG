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

// ── 23.3: Scoring — config, strategies, factory ────────────────────────────
export {
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
} from './engine/scoring.config.js';

export { CasualScoringStrategy, CompetitiveScoringStrategy } from './engine/scoring-strategies.js';
export { getScoringStrategy } from './engine/strategy-registry.js';

// ── 24.1: Time Decay — dynamic threshold model ────────────────────────────
export {
  INITIAL_THRESHOLD,
  MINIMUM_THRESHOLD_FLOOR,
  MAX_WAIT_REFERENCE,
  DECAY_RATE_K,
} from './engine/time-decay.config.js';

export { getAcceptableThreshold, resolveGroupThreshold } from './engine/time-decay-model.js';

// ── Mock generator — dev/test utility, NOT imported in production bundles ───
export { generateMockPlayers } from './mock/mock-player.generator.js';
