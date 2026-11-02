import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PostgreSQL source of truth for the matchmaking queue and match results.
 *
 * One row per user state machine:
 *   queued → matched (kept for the result TTL) → deleted
 *
 * The unique index on user_id is the cross-instance enqueue guard.
 */
export class MatchmakingPersistence1761955300000 implements MigrationInterface {
  name = 'MatchmakingPersistence1761955300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "matchmaking_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "game" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'queued',
        "payload" jsonb NOT NULL,
        "enqueued_at" timestamptz NOT NULL DEFAULT now(),
        "heartbeat_at" timestamptz NOT NULL DEFAULT now(),
        "matched_at" timestamptz,
        "match_expires_at" timestamptz,
        "lobby_id" uuid,
        "group_id" varchar(60),
        "score" double precision,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_matchmaking_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_matchmaking_entries_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_matchmaking_entries_lobby"
          FOREIGN KEY ("lobby_id") REFERENCES "lobbies"("id")
          ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_matchmaking_entries_user"
        ON "matchmaking_entries" ("user_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_matchmaking_entries_game_status_enqueued"
        ON "matchmaking_entries" ("game", "status", "enqueued_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_matchmaking_entries_status_heartbeat"
        ON "matchmaking_entries" ("status", "heartbeat_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_matchmaking_entries_status_expires"
        ON "matchmaking_entries" ("status", "match_expires_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS "matchmaking_entries" CASCADE',
    );
  }
}
