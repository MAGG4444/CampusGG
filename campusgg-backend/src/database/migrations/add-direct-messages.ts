import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessages1792368014000 implements MigrationInterface {
  name = 'AddDirectMessages1792368014000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    const table = `${s}."direct_messages"`;
    // Run migration before starting the development server to avoid synchronize
    // creating the table first. Fail safely rather than silently adopt unknown data.
    await queryRunner.query(`CREATE TABLE ${table} (
      "id" uuid DEFAULT uuid_generate_v4(),
      "sender_id" uuid NOT NULL,
      "recipient_id" uuid NOT NULL,
      "pair_key" varchar(73) NOT NULL,
      "content" varchar(2000) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "read_at" timestamptz,
      CONSTRAINT "PK_direct_messages" PRIMARY KEY ("id"),
      CONSTRAINT "FK_direct_messages_sender" FOREIGN KEY ("sender_id") REFERENCES ${s}."users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_direct_messages_recipient" FOREIGN KEY ("recipient_id") REFERENCES ${s}."users"("id") ON DELETE CASCADE,
      CONSTRAINT "CHK_direct_messages_distinct" CHECK ("sender_id" <> "recipient_id"),
      CONSTRAINT "CHK_direct_messages_pair" CHECK ("pair_key" = LEAST("sender_id", "recipient_id")::text || ':' || GREATEST("sender_id", "recipient_id")::text),
      CONSTRAINT "CHK_direct_messages_content" CHECK (char_length(btrim("content")) BETWEEN 1 AND 2000)
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_direct_messages_pair_order" ON ${table} ("pair_key", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_direct_messages_unread" ON ${table} ("recipient_id", "pair_key", "read_at")`,
    );
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Direct messages may contain user data. Use a reviewed backup and recovery plan.',
      ),
    );
  }
}
