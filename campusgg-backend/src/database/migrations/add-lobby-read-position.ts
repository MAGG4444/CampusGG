import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLobbyReadPosition1792368005000 implements MigrationInterface {
  name = 'AddLobbyReadPosition1792368005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    await queryRunner.query(
      `ALTER TABLE ${s}."lobby_members" ADD COLUMN IF NOT EXISTS "last_read_message_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE ${s}."lobby_members" ADD COLUMN IF NOT EXISTS "last_read_at" timestamptz`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lobby_members_last_read_message" ON ${s}."lobby_members" ("last_read_message_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    await queryRunner.query(
      `ALTER TABLE ${queryRunner.connection.driver.escape(schema)}."lobby_members" DROP COLUMN IF EXISTS "last_read_message_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${queryRunner.connection.driver.escape(schema)}."lobby_members" DROP COLUMN IF EXISTS "last_read_at"`,
    );
  }
}
