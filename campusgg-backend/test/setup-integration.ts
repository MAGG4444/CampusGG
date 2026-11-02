/**
 * Integration-test bootstrap.
 *
 * Uses a dedicated database URL so the destructive per-test TRUNCATE can
 * never touch the development database. If TEST_DATABASE_URL is absent the
 * integration suite is skipped.
 */

import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';

loadEnv({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
