/**
 * @file database-options.ts
 * @description Shared PostgreSQL connection options for NestJS and the
 *              TypeORM CLI.
 *
 * Local development uses plain TCP. AWS RDS/Zaurora only needs:
 *   DATABASE_URL=postgresql://...
 *   DATABASE_SSL=true
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=true   (or false with no CA bundle)
 *   DATABASE_SSL_CA=/path/to/rds-global-bundle.pem   (optional)
 *
 * Defaults are intentionally non-destructive outside the target environment.
 */

import { readFileSync } from 'node:fs';

/** TLS options accepted by node-postgres through TypeORM. */
export interface DatabaseSslOptions {
  readonly rejectUnauthorized: boolean;
  readonly ca?: string;
}

export interface DatabaseSslInput {
  readonly enabled?: string;
  readonly rejectUnauthorized?: string;
  readonly caPath?: string;
}

/**
 * Builds the `ssl` value for a PostgreSQL DataSource.
 *
 * - unset/empty  → undefined (lets `sslmode` in DATABASE_URL decide)
 * - "false"      → false
 * - "true"       → TLS enabled
 *
 * `rejectUnauthorized` defaults to true. Set it to false only when the
 * provider's CA bundle is not available on the instance.
 */
export function resolveDatabaseSsl(
  input: DatabaseSslInput,
): false | DatabaseSslOptions | undefined {
  if (input.enabled === undefined || input.enabled.trim() === '') {
    return undefined;
  }

  if (!isTruthy(input.enabled)) {
    return false;
  }

  const rejectUnauthorized =
    input.rejectUnauthorized === undefined
      ? true
      : isTruthy(input.rejectUnauthorized);

  const ca =
    input.caPath && input.caPath.trim() !== ''
      ? readFileSync(input.caPath, 'utf8')
      : undefined;

  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

/** Parses DATABASE_POOL_SIZE, clamped to a sane range. */
export function resolveDatabasePoolSize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }

  return Math.min(Math.floor(parsed), 100);
}

/** Parses DATABASE_CONNECTION_TIMEOUT_MS. */
export function resolveConnectionTimeout(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10_000;
  }

  return Math.floor(parsed);
}

/** Parses DATABASE_IDLE_TIMEOUT_MS. */
export function resolveIdleTimeout(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30_000;
  }

  return Math.floor(parsed);
}

function isTruthy(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
