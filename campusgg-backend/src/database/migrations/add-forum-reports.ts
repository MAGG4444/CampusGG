import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumReports1792368011000 implements MigrationInterface {
  name = 'AddForumReports1792368011000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.escape(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${schema}."forum_reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "reporter_id" uuid NOT NULL REFERENCES ${schema}."users"("id") ON DELETE CASCADE,
      "post_id" uuid NOT NULL REFERENCES ${schema}."forum_posts"("id") ON DELETE CASCADE,
      "comment_id" uuid NULL REFERENCES ${schema}."forum_comments"("id") ON DELETE CASCADE,
      "reason" varchar(40) NOT NULL,
      "custom_reason" text NULL,
      "details" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error('Reports contain user data and cannot be reverted safely'),
    );
  }
}
