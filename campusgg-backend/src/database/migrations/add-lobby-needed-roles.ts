import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLobbyNeededRoles1792368007000 implements MigrationInterface {
  name = 'AddLobbyNeededRoles1792368007000';

  private lobbiesTable(queryRunner: QueryRunner): string {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    return `${queryRunner.connection.driver.escape(schema)}."lobbies"`;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    const lobbies = this.lobbiesTable(queryRunner);
    await queryRunner.query(`ALTER TABLE ${lobbies}
      ADD COLUMN IF NOT EXISTS "needed_roles" text[] NOT NULL DEFAULT '{}'::text[]`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const lobbies = this.lobbiesTable(queryRunner);
    await queryRunner.query(
      `ALTER TABLE ${lobbies} DROP COLUMN IF EXISTS "needed_roles"`,
    );
  }
}
