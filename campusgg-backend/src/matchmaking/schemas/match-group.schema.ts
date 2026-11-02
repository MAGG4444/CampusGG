/**
 * @file match-group.schema.ts
 * @description Sub-issue 23.2 — Match Group Output Schema
 *
 * Defines the shape of the data that the matchmaking engine emits
 * when it successfully forms a group. This is the handoff contract
 * between the engine and the downstream lobby-creation service.
 *
 * The engine's only job is to produce MatchGroup objects.
 * It does NOT create or manage lobby state — that responsibility
 * belongs to the Lobby service (owned by another teammate).
 */

import type { SupportedGame } from './player-matchmaking.schema.js';
import type { GameTier } from '../engine/game-tiers.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Output interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The payload emitted by the engine when a match is found.
 *
 * Downstream consumers (Lobby service, analytics, notifications) receive
 * this shape via the `onMatchFound` callback.
 *
 * All fields are `readonly` — the engine hands off an immutable snapshot.
 */
export interface MatchGroup {
  /**
   * Unique identifier for this match group.
   * Format: `grp_<uuid-v4>` — namespaced to avoid ID collisions with users.
   */
  readonly groupId: string;

  /** The game this group was matched for. */
  readonly game: SupportedGame;

  /** The tier classification (for downstream routing / logging). */
  readonly tier: GameTier;

  /**
   * Ordered array of user IDs in this group.
   * Length is always equal to the tier's required group size
   * (5 for Competitive, 2 for Casual).
   */
  readonly userIds: ReadonlyArray<string>;

  /**
   * The compatibility score assigned by the active MatchStrategy.
   * Range: [0.0, 1.0]. Included for observability and analytics.
   */
  readonly score: number;

  /** ISO-8601 timestamp of when the match was formed. */
  readonly matchedAt: string;
}
