/**
 * Recommendation weights and tuning knobs.
 *
 * Scores are ranking indices in [0, 1], not probabilities. Keep every weight
 * here so the scorer stays a pure function and demos can tune behavior
 * without touching math.
 */

export const LOBBY_RECOMMENDATION_WEIGHTS = {
  skillFit: 0.3,
  roleFit: 0.3,
  campusFit: 0.25,
  occupancy: 0.1,
  freshness: 0.05,
} as const;

export const SUGGESTED_USER_WEIGHTS = {
  skillFit: 0.35,
  roleFit: 0.35,
  campusFit: 0.3,
} as const;

export const LOBBY_RECOMMENDATION_LIMIT = 3;
export const SUGGESTED_USER_LIMIT = 5;

/**
 * Below this score a lobby is hidden entirely. Weak no-profile or cross-game
 * candidates should produce an empty list, not a reasonless "possible" card.
 */
export const LOBBY_RECOMMENDATION_MIN_SCORE = 0.5;

/**
 * Role-fit values for lobby recommendations. A viewer's main role is the
 * strongest signal, their secondary role is slightly weaker, and any other
 * covered roles earn partial credit based on how much of the lobby they cover.
 */
export const LOBBY_ROLE_FIT = {
  /** Lobbies without listed roles stay neutral. */
  noRoles: 0.5,
  /** Viewer's first preferred role is needed. */
  primary: 1,
  /** Viewer's second preferred role is needed. */
  secondary: 0.85,
  /** Floor for a viewer who covers none of the needed roles. */
  uncovered: 0.15,
  /** Credit added per share of needed roles the viewer covers. */
  coverageWeight: 0.7,
} as const;

/** Lobbies untouched for this long are not recommended. */
export const LOBBY_STALE_HOURS = 14 * 24;

/** Exponential freshness decay half-life. */
export const FRESHNESS_HALF_LIFE_HOURS = 48;

/** A third slot is reserved for a new or under-filled lobby. */
export const EXPLORATION_MAX_AGE_HOURS = 2;
export const EXPLORATION_MAX_OCCUPANCY = 0.5;

export const FIT_LABELS = {
  great: 0.75,
  good: 0.55,
} as const;

export type SuggestedUserRoleMode = 'complement' | 'overlap';

export const SUGGESTED_USER_ROLE_MODE: SuggestedUserRoleMode =
  process.env.SUGGESTED_USER_ROLE_MODE === 'overlap' ? 'overlap' : 'complement';

export const MAX_RECOMMENDATION_CANDIDATES = 200;
