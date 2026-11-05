import { MigrationInterface, QueryRunner } from 'typeorm';

export class OneLobbyPerUser1792368004000 implements MigrationInterface {
  name = 'OneLobbyPerUser1792368004000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const table = `${queryRunner.connection.driver.escape(schema)}."lobby_members"`;
    const duplicates = (await queryRunner.query(
      `SELECT count(*)::text AS count FROM (SELECT user_id FROM ${table} GROUP BY user_id HAVING count(*) > 1) duplicates`,
    )) as Array<{ count: string }>;
    if (Number(duplicates[0].count) > 0)
      throw new Error(
        `Cannot enforce one lobby per user: ${duplicates[0].count} users have multiple memberships. Resolve them before retrying.`,
      );
    const existing = (await queryRunner.query(
      `SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = $2::regclass`,
      ['UQ_lobby_members_user', table],
    )) as unknown[];
    if (existing.length === 0) {
      await queryRunner.query(
        `ALTER TABLE ${table} ADD CONSTRAINT "UQ_lobby_members_user" UNIQUE ("user_id")`,
      );
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    await queryRunner.query(
      `ALTER TABLE ${queryRunner.connection.driver.escape(schema)}."lobby_members" DROP CONSTRAINT "UQ_lobby_members_user"`,
    );
  }
}
