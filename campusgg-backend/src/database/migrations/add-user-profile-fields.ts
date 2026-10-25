import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfile implements MigrationInterface {
  // TypeORM requires a timestamp suffix to order migrations. Keep this ID stable
  // because existing databases have already recorded it as applied.
  name = 'AddUserProfile1792368000000';

  private usersTable(queryRunner: QueryRunner): string {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    return `${queryRunner.connection.driver.escape(schema)}."users"`;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${this.usersTable(queryRunner)}
      ADD COLUMN "bio" varchar(500) NOT NULL DEFAULT '',
      ADD COLUMN "favorite_games" text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN "skill_level" varchar(20) NOT NULL DEFAULT ''`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${this.usersTable(queryRunner)}
      DROP COLUMN "skill_level", DROP COLUMN "favorite_games", DROP COLUMN "bio"`);
  }
}
