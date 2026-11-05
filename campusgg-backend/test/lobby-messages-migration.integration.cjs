// All DDL and data live in a transaction that is rolled back; no schema is dropped.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  DataSource,
  Table,
  TableForeignKey,
  MigrationExecutor,
} = require('typeorm');
const { User } = require('../dist/users/user.entity');
const { Lobby } = require('../dist/lobbies/lobby.entity');
const { LobbyMessage } = require('../dist/lobbies/lobby-message.entity');
const {
  AddLobbyMessages1792368003000,
} = require('../dist/database/migrations/add-lobby-messages');

async function scenario(kind) {
  const schema = `test_lobby_migration_${randomUUID().replaceAll('-', '')}`;
  const db = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    schema,
    entities: [User, Lobby, LobbyMessage],
    migrations: [AddLobbyMessages1792368003000],
    synchronize: false,
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(`CREATE SCHEMA "${schema}"`);
    await runner.query(`SET LOCAL search_path TO "${schema}", public`);
    await runner.query(`CREATE TABLE "${schema}".users (id uuid PRIMARY KEY)`);
    await runner.query(
      `CREATE TABLE "${schema}".lobbies (id uuid PRIMARY KEY)`,
    );
    await runner.query(
      `CREATE TABLE "${schema}".lobby_members (last_read_message_id uuid, last_read_at timestamptz)`,
    );
    const user = randomUUID(),
      lobby = randomUUID(),
      message = randomUUID();
    await runner.query(`INSERT INTO "${schema}".users VALUES ($1)`, [user]);
    await runner.query(`INSERT INTO "${schema}".lobbies VALUES ($1)`, [lobby]);

    if (kind !== 'fresh') {
      // Use the same entity metadata and table/foreign-key builders as synchronize.
      const metadata = db.getMetadata(LobbyMessage);
      const table = Table.create(metadata, db.driver);
      if (kind === 'bad-column')
        table.findColumnByName('content').length = '20';
      if (kind === 'bad-default') {
        table.findColumnByName('id').isGenerated = false;
        table.findColumnByName('id').default = undefined;
      }
      if (kind === 'bad-index') table.indices[0].columnNames.reverse();
      await runner.createTable(table, false, true, true);
      const foreignKeys = metadata.foreignKeys.map((fk) =>
        TableForeignKey.create(fk, db.driver),
      );
      await runner.createForeignKeys(
        table,
        kind === 'bad-foreign-key' ? foreignKeys.slice(0, 1) : foreignKeys,
      );
      await runner.query(
        `INSERT INTO "${schema}".lobby_messages (id, lobby_id, sender_id, content) VALUES ($1, $2, $3, 'preserve me')`,
        [message, lobby, user],
      );
      await runner.query(
        `INSERT INTO "${schema}".lobby_members VALUES ($1, '2026-01-01T00:00:00Z')`,
        [message],
      );
    }
    const executor = new MigrationExecutor(db, runner);
    if (kind.startsWith('bad-')) {
      await assert.rejects(
        executor.executePendingMigrations(),
        /incompatible/i,
      );
      assert.equal(
        (
          await runner.query(`SELECT content FROM "${schema}".lobby_messages`)
        )[0].content,
        'preserve me',
      );
      assert.equal(
        (
          await runner.query(
            `SELECT last_read_message_id FROM "${schema}".lobby_members`,
          )
        )[0].last_read_message_id,
        message,
      );
    } else {
      assert.equal((await executor.executePendingMigrations()).length, 1);
      assert.equal((await executor.executePendingMigrations()).length, 0);
      if (kind !== 'fresh') {
        assert.equal(
          (
            await runner.query(`SELECT content FROM "${schema}".lobby_messages`)
          )[0].content,
          'preserve me',
        );
        assert.equal(
          (
            await runner.query(
              `SELECT last_read_message_id FROM "${schema}".lobby_members`,
            )
          )[0].last_read_message_id,
          message,
        );
      }
      await new AddLobbyMessages1792368003000().up(runner); // validate fresh-created schema too
      await assert.rejects(
        new AddLobbyMessages1792368003000().down(),
        /Cannot automatically revert/,
      );
    }
    console.log(`${kind}: passed`);
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await db.destroy();
  }
}
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  for (const kind of [
    'fresh',
    'synchronized',
    'bad-column',
    'bad-default',
    'bad-index',
    'bad-foreign-key',
  ])
    await scenario(kind);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
