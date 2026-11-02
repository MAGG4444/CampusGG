import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfile1792368000000 implements MigrationInterface {
  name = 'AddUserProfile1792368000000';

  private usersTable(queryRunner: QueryRunner): string {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    return `${queryRunner.connection.driver.escape(schema)}."users"`;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${this.usersTable(queryRunner)}
      ADD COLUMN IF NOT EXISTS "bio" varchar(500) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "favorite_games" text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS "skill_level" varchar(20) NOT NULL DEFAULT ''`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${this.usersTable(queryRunner)}
      DROP COLUMN IF EXISTS "skill_level",
      DROP COLUMN IF EXISTS "favorite_games",
      DROP COLUMN IF EXISTS "bio"`);
  }
}
