import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSteamAccount1792368006000 implements MigrationInterface {
  name = 'AddSteamAccount1792368006000';

  private schema(queryRunner: QueryRunner): string {
    return (
      (queryRunner.connection.options as { schema?: string }).schema ?? 'public'
    );
  }

  private usersTable(queryRunner: QueryRunner): string {
    return `${queryRunner.connection.driver.escape(this.schema(queryRunner))}."users"`;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    const users = this.usersTable(queryRunner);

    await queryRunner.query(`ALTER TABLE ${users}
      ADD COLUMN IF NOT EXISTS "steam_id" varchar(17),
      ADD COLUMN IF NOT EXISTS "steam_linked_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "steam_synced_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "steam_cs2_playtime_minutes" integer,
      ADD COLUMN IF NOT EXISTS "steam_dota2_playtime_minutes" integer`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_steam_id" ON ${users} ("steam_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const users = this.usersTable(queryRunner);

    await queryRunner.query(
      `DROP INDEX IF EXISTS ${queryRunner.connection.driver.escape(this.schema(queryRunner))}."UQ_users_steam_id"`,
    );

    await queryRunner.query(`ALTER TABLE ${users}
      DROP COLUMN IF EXISTS "steam_dota2_playtime_minutes",
      DROP COLUMN IF EXISTS "steam_cs2_playtime_minutes",
      DROP COLUMN IF EXISTS "steam_synced_at",
      DROP COLUMN IF EXISTS "steam_linked_at",
      DROP COLUMN IF EXISTS "steam_id"`);
  }
}
