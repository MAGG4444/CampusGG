/**
 * @file index.ts  (matchmaking module barrel)
 * @description Public API surface for the matchmaking module.
 *
 * Consumers (engine, controllers, tests) should import from this barrel:
 *
 *   import type { PlayerMatchmakingInput } from '../matchmaking';
 *   import { generateMockPlayers }         from '../matchmaking';
 *
 * This keeps internal folder structure an implementation detail.
 */

// Schema — types and interfaces (engine interface contract)
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

// Mock generator — dev/test utility, NOT imported in production bundles
export { generateMockPlayers } from './mock/mock-player.generator.js';
