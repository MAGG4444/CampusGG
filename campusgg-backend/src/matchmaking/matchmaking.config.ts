/**
 * @file matchmaking.config.ts
 * @description Runtime defaults for the PostgreSQL-backed matchmaking queue.
 *
 * Every value can be overridden through the environment. The defaults are
 * deliberately conservative for a single-campus deployment and are safe to
 * run behind multiple API instances.
 */

/** A queued player must poll at least this often or their entry is removed. */
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;

/** How long a matched player can retrieve their lobby ID. */
export const DEFAULT_MATCH_RESULT_TTL_MS = 5 * 60 * 1000;

/** Maximum number of queued rows loaded into one tick. */
export const DEFAULT_BATCH_SIZE = 1_000;

/** How often the in-process scheduler attempts a tick. */
export const DEFAULT_TICK_INTERVAL_MS = 3_000;

/** Number of queued players considered by the best-group search. */
export const DEFAULT_SEARCH_WINDOW = 15;

/**
 * Reads a positive integer from configuration, falling back when the value
 * is missing, non-numeric, zero, or negative.
 */
export function readPositiveInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}
