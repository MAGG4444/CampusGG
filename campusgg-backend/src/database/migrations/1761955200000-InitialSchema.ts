import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema for the tables that existed before migrations were enabled.
 *
 * `IF NOT EXISTS` lets an existing development database adopt this migration
 * without being dropped. Fresh databases (including CI and RDS) get the
 * complete schema in one transaction.
 */
export class InitialSchema1761955200000 implements MigrationInterface {
  name = 'InitialSchema1761955200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "lobbies_visibility_enum" AS ENUM ('public', 'private', 'friends');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL,
        "username" varchar(50) NOT NULL,
        "display_name" varchar(100),
        "edu_verified" boolean NOT NULL DEFAULT false,
        "verification_token" varchar,
        "token_expires_at" timestamptz,
        "password" varchar,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email"
        ON "users" ("email");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_username"
        ON "users" ("username");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_verification_token"
        ON "users" ("verification_token");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lobbies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lobby_name" varchar(60) NOT NULL,
        "subtitle" varchar(160),
        "details" varchar(500) NOT NULL,
        "tags" text[] NOT NULL,
        "game" varchar(50),
        "skill_level" varchar(30),
        "participant_limit" integer,
        "visibility" "lobbies_visibility_enum" NOT NULL DEFAULT 'public',
        "host_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lobbies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lobbies_host"
          FOREIGN KEY ("host_id") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lobby_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lobby_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(10) NOT NULL DEFAULT 'member',
        "joined_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lobby_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lobby_members_lobby_user" UNIQUE ("lobby_id", "user_id"),
        CONSTRAINT "FK_lobby_members_lobby"
          FOREIGN KEY ("lobby_id") REFERENCES "lobbies"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_lobby_members_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "forum_posts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" varchar(120) NOT NULL,
        "content" text NOT NULL,
        "game" varchar(50),
        "author_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_forum_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_forum_posts_author"
          FOREIGN KEY ("author_id") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "forum_comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "content" text NOT NULL,
        "post_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_forum_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_forum_comments_post"
          FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_forum_comments_author"
          FOREIGN KEY ("author_id") REFERENCES "users"("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "forum_post_likes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "post_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_forum_post_likes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_forum_post_user_like" UNIQUE ("post_id", "user_id"),
        CONSTRAINT "FK_forum_post_likes_post"
          FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_forum_post_likes_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "forum_post_likes" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "forum_comments" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "forum_posts" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "lobby_members" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "lobbies" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "users" CASCADE');
    await queryRunner.query('DROP TYPE IF EXISTS "lobbies_visibility_enum"');
  }
}
