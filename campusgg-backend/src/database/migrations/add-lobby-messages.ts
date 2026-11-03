import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLobbyMessages1792368003000 implements MigrationInterface {
  name = 'AddLobbyMessages1792368003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    await queryRunner.query(`CREATE TABLE ${s}."lobby_messages" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "lobby_id" uuid NOT NULL REFERENCES ${s}."lobbies"("id") ON DELETE CASCADE,
      "sender_id" uuid NOT NULL REFERENCES ${s}."users"("id") ON DELETE CASCADE,
      "content" varchar(2000) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_lobby_messages_order" ON ${s}."lobby_messages" ("lobby_id", "created_at", "id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    await queryRunner.query(
      `DROP TABLE ${queryRunner.connection.driver.escape(schema)}."lobby_messages"`,
    );
  }
}
