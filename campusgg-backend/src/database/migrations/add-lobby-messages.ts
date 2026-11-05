import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLobbyMessages1792368003000 implements MigrationInterface {
  name = 'AddLobbyMessages1792368003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    const tableName = `${s}."lobby_messages"`;
    const tablePath = `${schema}.lobby_messages`;
    if (await queryRunner.hasTable(tablePath)) {
      // Keep the schema stable while inspecting it. TypeORM's migration runner
      // executes this migration in a transaction.
      await queryRunner.query(
        `LOCK TABLE ${tableName} IN ACCESS EXCLUSIVE MODE`,
      );
      const table = await queryRunner.getTable(tablePath);
      if (!table) throw new Error('Unable to inspect existing lobby_messages.');
      const errors: string[] = [];
      const expected = [
        ['id', 'uuid', ''],
        ['lobby_id', 'uuid', ''],
        ['sender_id', 'uuid', ''],
        ['content', 'character varying', '2000'],
        ['created_at', 'timestamp with time zone', ''],
      ];
      for (const [name, type, length] of expected) {
        const column = table.findColumnByName(name);
        if (
          !column ||
          column.type !== type ||
          column.length !== length ||
          column.isNullable ||
          column.isArray
        ) {
          errors.push(`column ${name}`);
        }
      }
      const id = table.findColumnByName('id');
      const timestamp = table.findColumnByName('created_at');
      if (
        table.primaryColumns.length !== 1 ||
        !id?.isPrimary ||
        !id.isGenerated ||
        id.generationStrategy !== 'uuid'
      ) {
        errors.push('UUID primary key and default');
      }
      if (
        !timestamp?.default ||
        !/^(now\(\)|CURRENT_TIMESTAMP)$/i.test(String(timestamp.default))
      ) {
        errors.push('created_at default');
      }
      for (const [column, target] of [
        ['lobby_id', 'lobbies'],
        ['sender_id', 'users'],
      ]) {
        if (
          !table.foreignKeys.some(
            (fk) =>
              fk.columnNames.length === 1 &&
              fk.columnNames[0] === column &&
              fk.referencedSchema === schema &&
              fk.referencedTableName === target &&
              fk.referencedColumnNames.length === 1 &&
              fk.referencedColumnNames[0] === 'id' &&
              fk.onDelete === 'CASCADE',
          )
        ) {
          errors.push(`${column} foreign key`);
        }
      }
      if (table.foreignKeys.length !== 2)
        errors.push('unexpected foreign keys');
      const index = table.indices.find(
        (item) => item.name === 'IDX_lobby_messages_order',
      );
      if (!index || index.isUnique || index.where || index.type !== 'btree') {
        errors.push('IDX_lobby_messages_order index');
      }
      const state = (await queryRunner.query(
        `SELECT i.indisvalid AND i.indisready AND i.indpred IS NULL
           AND i.indexprs IS NULL AND i.indnatts = 3 AND i.indnkeyatts = 3
           AND array_to_string(i.indoption::smallint[], ',') = '0,0,0' AS valid,
           ARRAY(SELECT pg_get_indexdef(i.indexrelid, n, true)
             FROM generate_series(1, i.indnatts) n) AS columns
         FROM pg_index i JOIN pg_class idx ON idx.oid = i.indexrelid
         WHERE i.indrelid = $1::regclass AND idx.relname = $2`,
        [tableName, 'IDX_lobby_messages_order'],
      )) as Array<{ valid: boolean; columns: string[] }>;
      if (
        !state[0]?.valid ||
        state[0].columns.join(',') !== 'lobby_id,created_at,id'
      ) {
        errors.push('valid message ordering index');
      }
      const unvalidated = (await queryRunner.query(
        `SELECT 1 FROM pg_constraint WHERE conrelid = $1::regclass
         AND contype = 'f' AND NOT convalidated`,
        [tableName],
      )) as unknown[];
      if (unvalidated.length) errors.push('unvalidated foreign key');
      const expectedNames = new Set(expected.map(([name]) => name));
      if (
        table.columns.some(
          (column) =>
            !expectedNames.has(column.name) &&
            !column.isNullable &&
            column.default === undefined &&
            !column.isGenerated,
        ) ||
        table.uniques.length ||
        table.checks.length ||
        table.indices.some((item) => item.isUnique)
      ) {
        errors.push('additional restrictive columns or constraints');
      }
      if (errors.length) {
        throw new Error(
          `Existing ${tableName} is incompatible: ${errors.join(', ')}. Inspect and repair it without deleting existing messages, then retry the migration.`,
        );
      }
      return;
    }
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

  down(): Promise<void> {
    // The table may predate this migration and contain user messages. TypeORM's
    // migration history cannot tell whether it was created or adopted here.
    return Promise.reject(
      new Error(
        'Cannot automatically revert lobby messages: the table may contain existing data. Use a reviewed backup and recovery plan.',
      ),
    );
  }
}
