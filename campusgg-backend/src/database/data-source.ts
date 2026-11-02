/**
 * @file data-source.ts
 * @description TypeORM CLI entry point.
 *
 * Used by:
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:show
 *
 * The NestJS application builds its own DataSource from AppModule, but both
 * paths share the same SSL/pool configuration and entity list.
 */

import 'reflect-metadata';

import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { ForumComment } from '../forum/forum-comment.entity';
import { ForumPostLike } from '../forum/forum-post-like.entity';
import { ForumPost } from '../forum/forum-post.entity';
import { LobbyMember } from '../lobbies/lobby-member.entity';
import { Lobby } from '../lobbies/lobby.entity';
import { MatchmakingEntry } from '../matchmaking/entities/matchmaking-entry.entity';
import { User } from '../users/user.entity';

import {
  resolveConnectionTimeout,
  resolveDatabasePoolSize,
  resolveDatabaseSsl,
  resolveIdleTimeout,
} from './database-options';

// Load backend/.env for CLI runs. Existing process variables always win.
loadEnv({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Copy campusgg-backend/.env.example to .env or export it in the environment.',
  );
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: databaseUrl,

  ssl: resolveDatabaseSsl({
    enabled: process.env.DATABASE_SSL,
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    caPath: process.env.DATABASE_SSL_CA,
  }),

  extra: {
    max: resolveDatabasePoolSize(process.env.DATABASE_POOL_SIZE),
    connectionTimeoutMillis: resolveConnectionTimeout(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS,
    ),
    idleTimeoutMillis: resolveIdleTimeout(process.env.DATABASE_IDLE_TIMEOUT_MS),
  },

  // gen_random_uuid() is built into PostgreSQL 13+. Disable TypeORM's
  // extension bootstrap so a managed RDS user does not need CREATE EXTENSION.
  uuidExtension: 'pgcrypto',
  installExtensions: false,

  entities: [
    User,
    Lobby,
    LobbyMember,
    ForumPost,
    ForumComment,
    ForumPostLike,
    MatchmakingEntry,
  ],

  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],

  // Migrations are the only schema authority. Never let TypeORM mutate the
  // production schema at startup.
  synchronize: false,
  migrationsRun: false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
