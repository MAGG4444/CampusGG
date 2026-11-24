import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConnections1792368013000 implements MigrationInterface {
  name = 'AddConnections1792368013000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ?? 'public';
    const s = queryRunner.connection.driver.escape(schema);
    const table = `${s}."connections"`;
    // The migration can also adopt a compatible development table created by
    // TypeORM synchronize. Never silently accept a different table layout.
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table} (
      "id" uuid DEFAULT uuid_generate_v4(),
      "requester_id" uuid NOT NULL,
      "recipient_id" uuid NOT NULL,
      "pair_key" varchar(73) NOT NULL,
      "status" varchar(8) NOT NULL DEFAULT 'pending',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_connections" PRIMARY KEY ("id"),
      CONSTRAINT "FK_connections_requester" FOREIGN KEY ("requester_id") REFERENCES ${s}."users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_connections_recipient" FOREIGN KEY ("recipient_id") REFERENCES ${s}."users"("id") ON DELETE CASCADE,
      CONSTRAINT "CHK_connections_distinct_users" CHECK ("requester_id" <> "recipient_id"),
      CONSTRAINT "CHK_connections_status" CHECK ("status" IN ('pending', 'accepted')),
      CONSTRAINT "CHK_connections_pair_key" CHECK ("pair_key" = LEAST("requester_id", "recipient_id")::text || ':' || GREATEST("requester_id", "recipient_id")::text)
    )`);
    await queryRunner.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_connections_pair_key" ON ${table} ("pair_key")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_connections_requester_status" ON ${table} ("requester_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_connections_recipient_status" ON ${table} ("recipient_id", "status")`);

    const metadata = await queryRunner.getTable(`${schema}.connections`);
    if (!metadata) throw new Error('Unable to inspect connections table.');
    const columns = [
      ['id', 'uuid', ''],
      ['requester_id', 'uuid', ''],
      ['recipient_id', 'uuid', ''],
      ['pair_key', 'character varying', '73'],
      ['status', 'character varying', '8'],
      ['created_at', 'timestamp with time zone', ''],
      ['updated_at', 'timestamp with time zone', ''],
    ];
    const compatibleColumns = columns.every(([name, type, length]) => {
      const col = metadata.findColumnByName(name);
      return col && col.type === type && (col.length || '') === length && !col.isNullable;
    });
    const compatibleKeys = ['requester_id', 'recipient_id'].every((name) =>
      metadata.foreignKeys.some((key) =>
        key.columnNames.join(',') === name &&
        key.referencedSchema === schema &&
        key.referencedTableName === 'users' &&
        key.referencedColumnNames.join(',') === 'id' &&
        key.onDelete === 'CASCADE',
      ),
    );
    const checks = [
      'CHK_connections_distinct_users',
      'CHK_connections_status',
      'CHK_connections_pair_key',
    ];
    const unique = metadata.indices.some((index) =>
      index.name === 'UQ_connections_pair_key' && index.isUnique &&
      !index.where && index.columnNames.join(',') === 'pair_key',
    );
    if (!compatibleColumns || !compatibleKeys || !unique ||
        metadata.primaryColumns.map((column) => column.name).join(',') !== 'id' ||
        !metadata.findColumnByName('id')?.isGenerated ||
        !checks.every((name) => metadata.checks.some((check) => check.name === name))) {
      throw new Error('Existing connections table is incompatible. Review the schema before retrying; do not delete user data.');
    }
  }

  down(): Promise<void> {
    return Promise.reject(new Error('Connections may contain user data. Use a reviewed backup and recovery plan rather than dropping the table.'));
  }
}
