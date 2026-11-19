import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumCommentThreads1792368010000 implements MigrationInterface {
  name = 'AddForumCommentThreads1792368010000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.escape(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    );
    await queryRunner.query(
      `ALTER TABLE ${schema}."forum_comments" ADD COLUMN IF NOT EXISTS "parent_reply_id" uuid NULL REFERENCES ${schema}."forum_comments"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_forum_comments_parent" ON ${schema}."forum_comments" ("parent_reply_id")`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${schema}."forum_comment_likes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "comment_id" uuid NOT NULL REFERENCES ${schema}."forum_comments"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES ${schema}."users"("id") ON DELETE CASCADE,
      CONSTRAINT "UQ_forum_comment_user_like" UNIQUE ("comment_id", "user_id")
    )`);
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Comment threads contain user data and cannot be reverted safely',
      ),
    );
  }
}
