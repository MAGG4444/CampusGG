/**
 * @file player-matchmaking.schema.ts
 * @description Sub-issue 23.1 — Interface Contract (Data Schema)
 *
 * This file is the single source of truth for the shape of a player's
 * matchmaking payload. It is intentionally free of business logic and
 * framework decorators so it can be imported by:
 *   - The matchmaking engine (algorithm layer)
 *   - The mock data generator (dev/testing layer)
 *   - The DTO validators (NestJS / class-validator layer)
 *
 * Design principles followed:
 *   - Single Responsibility  : each interface owns exactly one concern
 *   - Open/Closed            : add new games by extending SUPPORTED_GAMES
 *   - Interface Segregation  : profile, stats, and preferences are split
 *   - Liskov Substitution    : game-specific stat types are substitutable
 *
 * The runtime arrays (SUPPORTED_GAMES, ACTIVE_SCHEDULES, ...) are the source
 * of truth for both TypeScript types and runtime validation. This prevents the
 * validation layer from drifting away from the type definitions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums — runtime arrays are the single source of truth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supported games on the platform.
 * Extend this array as new titles are onboarded.
 */
export const SUPPORTED_GAMES = [
  'CS2',
  'Valorant',
  'Rocket League',
  'League of Legends',
  'Dota',
  'OW2',
  'It Takes Two',
] as const;

export type SupportedGame = (typeof SUPPORTED_GAMES)[number];

/**
 * CS2-specific in-game roles.
 * Other games define their own role lists in the game configuration.
 */
export const CS2_ROLES = [
  'IGL',
  'Entry',
  'AWPer',
  'Lurker',
  'Support',
] as const;

export type CS2Role = (typeof CS2_ROLES)[number];

/**
 * Broad availability buckets that map to recurring weekly time slots.
 * These are coarse-grained on purpose — fine-grained scheduling is
 * handled by the calendar integration layer (future work).
 */
export const ACTIVE_SCHEDULES = [
  'Weekday Morning', // Mon–Fri, ~7 AM – 12 PM
  'Weekday Afternoon', // Mon–Fri, ~12 PM – 6 PM
  'Weekday Evening', // Mon–Fri, ~6 PM – 11 PM
  'Weekend Morning', // Sat–Sun, ~7 AM – 12 PM
  'Weekend Afternoon', // Sat–Sun, ~12 PM – 6 PM
  'Friday Night', // Fri, ~9 PM – 2 AM (prime collegiate slot)
  'Late Night', // Any day, ~11 PM – 3 AM
] as const;

export type ActiveSchedule = (typeof ACTIVE_SCHEDULES)[number];

/**
 * Verified university email domains supported by CampusGG.
 * Populated with Big Ten / large-enrollment schools for the mock pool.
 */
export const UNIVERSITY_DOMAINS = [
  'purdue.edu',
  'illinois.edu',
  'indiana.edu',
  'msu.edu',
  'umich.edu',
  'osu.edu',
  'wisc.edu',
  'umn.edu',
  'northwestern.edu',
  'psu.edu',
] as const;

export type UniversityDomain = (typeof UNIVERSITY_DOMAINS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-interfaces — each represents a logical grouping of player data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collegiate profile data, sourced from the verified .edu sign-up flow.
 * This is the "who you are outside the game" dimension.
 */
export interface PlayerProfile {
  /** Verified .edu domain — the primary trust signal on CampusGG. */
  readonly universityDomain: UniversityDomain;

  /**
   * Player's academic major.
   * Used for "same major" affinity scoring (soft preference, not a filter).
   */
  readonly major: string;

  /**
   * Self-reported coarse time slot when the player is most available.
   * Reserved for schedule-overlap scoring in a future scoring revision.
   */
  readonly activeSchedule: ActiveSchedule;
}

/**
 * Generic ranked statistics for a supported game.
 *
 * `rating` is a game-specific skill metric normalised to the same 0–35,000
 * range used by CS2 Premier for the MVP. A future revision can replace this
 * with a per-game percentile once each title has its own stat schema.
 */
export interface GameStats {
  readonly game: SupportedGame;

  /**
   * Skill rating used as the primary skill-distance metric.
   * Range: 0 – 35,000 (typical active range: 10,000 – 25,000).
   */
  readonly rating: number;
}

/** CS2-specific alias retained for documentation and mock generation. */
export type CS2Stats = GameStats & { readonly game: 'CS2' };

/**
 * Player's expressed in-game preferences for team composition matching.
 * These are self-reported; future versions will validate against match history.
 *
 * Role values are intentionally strings rather than a fixed union: each game
 * has its own role vocabulary, validated at the API boundary against
 * GAME_ROLES in game-tiers.config.ts.
 */
export interface PlayerPreferences {
  /**
   * The role the player most prefers to play.
   * Weighted highest in the role-compatibility scoring pass.
   */
  readonly primaryRole: string;

  /**
   * Fallback role the player is willing to fill.
   * Weighted lower but prevents hard mismatches in 5-stack composition.
   */
  readonly secondaryRole: string;

  /**
   * Whether the player uses a microphone.
   * A key binary signal for team communication compatibility.
   * Platform target: ~80% of the user base has mic enabled.
   */
  readonly micEnabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Interface — the complete matchmaking input payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical matchmaking input for a single player.
 *
 * This is the contract between:
 *   - The queue service  (producer — validates and enqueues this shape)
 *   - The engine service (consumer — reads this shape to compute scores)
 *
 * All fields are `readonly` to enforce immutability once enqueued.
 * The engine must not mutate player data; it only produces match results.
 *
 * Queue wait time is deliberately NOT part of this contract. The engine
 * records `enqueuedAt` on the server when the player enters the queue and
 * derives elapsed time from its own clock. Client-supplied wait times are
 * therefore impossible to spoof.
 */
export interface PlayerMatchmakingInput {
  /**
   * Platform-assigned unique identifier.
   * Format: `usr_<uuid-v4>` — namespaced for future multi-entity ID space.
   */
  readonly userId: string;

  /**
   * The game this player is queuing for.
   * Acts as a partition key — players only match within the same game.
   */
  readonly game: SupportedGame;

  /** Collegiate identity and availability context. */
  readonly profile: PlayerProfile;

  /**
   * Game-specific ranked statistics.
   * The `game` discriminant on `GameStats` must match the root `game` field.
   */
  readonly stats: GameStats;

  /** Expressed role and communication preferences. */
  readonly preferences: PlayerPreferences;

  /**
   * Play-style intensity on a continuous [0.0, 1.0] scale.
   *
   *   0.0 -> Fully casual / social / chill
   *   0.5 -> Balanced / semi-competitive
   *   1.0 -> Hardcore / try-hard / tournament-focused
   *
   * This is the primary toxicity-prevention signal:
   * matching players with similar intensity reduces frustration from
   * mismatched expectations (e.g., pairing a 0.1 with a 0.9).
   */
  readonly intensity: number;
}
