import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumChannelFollows1792368007000 implements MigrationInterface {
  name = 'AddForumChannelFollows1792368007000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${s}."forum_channel_follows" (
      "user_id" uuid NOT NULL REFERENCES ${s}."users"("id") ON DELETE CASCADE,
      "channel_id" varchar(64) NOT NULL REFERENCES ${s}."forum_channels"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("user_id", "channel_id")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_forum_channel_follows_channel" ON ${s}."forum_channel_follows" ("channel_id")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    await queryRunner.query(
      `DROP TABLE ${queryRunner.connection.driver.escape(schema)}."forum_channel_follows"`,
    );
  }
}
