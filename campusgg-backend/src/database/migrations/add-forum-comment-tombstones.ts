import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumCommentTombstones1792368012000 implements MigrationInterface {
  name = 'AddForumCommentTombstones1792368012000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.escape(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    );
    await queryRunner.query(
      `ALTER TABLE ${schema}."forum_comments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE ${schema}."forum_comments" ALTER COLUMN "author_id" DROP NOT NULL`,
    );
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error('Deleted reply identities cannot be restored'),
    );
  }
}
