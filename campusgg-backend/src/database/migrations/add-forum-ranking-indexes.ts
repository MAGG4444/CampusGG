import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddForumRankingIndexes1792368008000 implements MigrationInterface {
  name = 'AddForumRankingIndexes1792368008000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_forum_posts_rank_date" ON ${s}."forum_posts" ("created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_forum_comments_post" ON ${s}."forum_comments" ("post_id")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    await queryRunner.query(
      `DROP INDEX IF EXISTS ${s}."IDX_forum_comments_post"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS ${s}."IDX_forum_posts_rank_date"`,
    );
  }
}
