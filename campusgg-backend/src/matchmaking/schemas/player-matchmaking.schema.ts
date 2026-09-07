/**
 * @file player-matchmaking.schema.ts
 * @description Sub-issue 23.1 — Interface Contract (Data Schema)
 *
 * This file is the single source of truth for the shape of a player's
 * matchmaking payload. It is intentionally free of business logic and
 * framework decorators so it can be imported by:
 *   - The matchmaking engine (algorithm layer)
 *   - The mock data generator (dev/testing layer)
 *   - Future DTO validators (NestJS / class-validator layer)
 *
 * Design principles followed:
 *   - Single Responsibility  : each interface owns exactly one concern
 *   - Open/Closed            : add new games by extending GameStats union
 *   - Interface Segregation  : profile, stats, and preferences are split
 *   - Liskov Substitution    : game-specific stat types are substitutable
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums — all categorical options as literal-safe string union types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supported games on the platform.
 * Extend this union as new titles are onboarded.
 */
export type SupportedGame = 'CS2' | 'Valorant' | 'Rocket League' | 'League of Legends';

/**
 * CS2-specific in-game roles.
 * Used for role-based matchmaking and team composition logic.
 */
export type CS2Role = 'IGL' | 'Entry' | 'AWPer' | 'Lurker' | 'Support';

/**
 * Broad availability buckets that map to recurring weekly time slots.
 * These are coarse-grained on purpose — fine-grained scheduling is
 * handled by the calendar integration layer (future work).
 */
export type ActiveSchedule =
  | 'Weekday Morning'    // Mon–Fri, ~7 AM – 12 PM
  | 'Weekday Afternoon'  // Mon–Fri, ~12 PM – 6 PM
  | 'Weekday Evening'    // Mon–Fri, ~6 PM – 11 PM
  | 'Weekend Morning'    // Sat–Sun, ~7 AM – 12 PM
  | 'Weekend Afternoon'  // Sat–Sun, ~12 PM – 6 PM
  | 'Friday Night'       // Fri, ~9 PM – 2 AM (prime collegiate slot)
  | 'Late Night';        // Any day, ~11 PM – 3 AM

/**
 * Verified university email domains supported by CampusGG.
 * Populated with Big Ten / large-enrollment schools for the mock pool.
 */
export type UniversityDomain =
  | 'purdue.edu'
  | 'illinois.edu'
  | 'indiana.edu'
  | 'msu.edu'
  | 'umich.edu'
  | 'osu.edu'
  | 'wisc.edu'
  | 'umn.edu'
  | 'northwestern.edu'
  | 'psu.edu';

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
   * Used for schedule-overlap scoring in the matchmaking weights.
   */
  readonly activeSchedule: ActiveSchedule;
}

/**
 * CS2-specific ranked statistics.
 * Follows the CS2 Premier rating system (0 – 35,000, typical play 10k–25k).
 */
export interface CS2Stats {
  readonly game: 'CS2';

  /**
   * CS2 Premier rating.
   * Range: 10,000 – 25,000 (hard-capped to active competitive range).
   * Used as the primary skill-distance metric in the engine.
   */
  readonly rating: number;
}

/**
 * Discriminated union of all supported game stat blocks.
 * The engine switches on `game` to extract the correct numeric skill metric.
 *
 * @example
 * function getSkillRating(stats: GameStats): number {
 *   switch (stats.game) {
 *     case 'CS2': return stats.rating;
 *     // future cases here
 *   }
 * }
 */
export type GameStats = CS2Stats; // Extend: | ValorantStats | RLStats

/**
 * Player's expressed in-game preferences for team composition matching.
 * These are self-reported; future versions will validate against match history.
 */
export interface PlayerPreferences {
  /**
   * The role the player most prefers to play.
   * Weighted highest in the role-compatibility scoring pass.
   */
  readonly primaryRole: CS2Role;

  /**
   * Fallback role the player is willing to fill.
   * Weighted lower but prevents hard mismatches in 5-stack composition.
   */
  readonly secondaryRole: CS2Role;

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

  /**
   * Elapsed seconds the player has been waiting in the queue.
   * Consumed by the time-decay logic to progressively relax match criteria
   * and prevent players from waiting indefinitely.
   * Starts at 0 when the player first enters the queue.
   */
  readonly queueTime: number;
}
