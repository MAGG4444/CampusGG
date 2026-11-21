import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumPostFollows1792368009000 implements MigrationInterface {
  name = 'AddForumPostFollows1792368009000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.escape(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${schema}."forum_post_follows" (
      "user_id" uuid NOT NULL REFERENCES ${schema}."users"("id") ON DELETE CASCADE,
      "post_id" uuid NOT NULL REFERENCES ${schema}."forum_posts"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("user_id", "post_id")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_forum_post_follows_post" ON ${schema}."forum_post_follows" ("post_id")`,
    );
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error('Post follows contain user data and cannot be reverted safely'),
    );
  }
}
