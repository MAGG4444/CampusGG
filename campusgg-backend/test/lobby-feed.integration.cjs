// Transaction-only fixture: all schema and rows are rolled back, never dropped.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { User } = require('../dist/users/user.entity');
const { Lobby } = require('../dist/lobbies/lobby.entity');
const { LobbyMember } = require('../dist/lobbies/lobby-member.entity');
const { LobbiesService } = require('../dist/lobbies/lobbies.service');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `test_feed_${randomUUID().replaceAll('-', '')}`;
  const db = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, schema, entities: [User, Lobby, LobbyMember], synchronize: false });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(`CREATE SCHEMA "${schema}"`);
    await runner.query(`CREATE TABLE "${schema}".users (id uuid PRIMARY KEY, username varchar NOT NULL)`);
    await runner.query(`CREATE TABLE "${schema}".lobbies (
      id uuid PRIMARY KEY, lobby_name varchar NOT NULL, subtitle varchar, details varchar NOT NULL,
      tags text[] NOT NULL, game varchar, skill_level varchar, participant_limit integer,
      visibility varchar NOT NULL, host_id uuid NOT NULL REFERENCES "${schema}".users(id),
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE TABLE "${schema}".lobby_members (
      id uuid PRIMARY KEY, lobby_id uuid NOT NULL REFERENCES "${schema}".lobbies(id),
      user_id uuid NOT NULL REFERENCES "${schema}".users(id), role varchar NOT NULL,
      joined_at timestamp NOT NULL DEFAULT now(), last_read_message_id uuid, last_read_at timestamptz
    )`);
    const [host, member, privateHost, publicLobby, privateLobby] = Array.from({ length: 5 }, () => randomUUID());
    for (const [id, name] of [[host, 'host'], [member, 'member'], [privateHost, 'private-host']]) {
      await runner.query(`INSERT INTO "${schema}".users (id, username) VALUES ($1, $2)`, [id, name]);
    }
    await runner.query(`INSERT INTO "${schema}".lobbies (id, lobby_name, details, tags, visibility, host_id, participant_limit) VALUES ($1, 'public', 'details', '{}', 'public', $2, 5), ($3, 'private', 'details', '{}', 'private', $4, NULL)`, [publicLobby, host, privateLobby, privateHost]);
    for (const [lobby, user, role] of [[publicLobby, host, 'host'], [publicLobby, member, 'member'], [privateLobby, privateHost, 'host']]) {
      await runner.query(`INSERT INTO "${schema}".lobby_members (id, lobby_id, user_id, role) VALUES ($1, $2, $3, $4)`, [randomUUID(), lobby, user, role]);
    }
    const service = new LobbiesService(runner.manager.getRepository(Lobby), {});
    assert.deepEqual(await service.findAll({ game: 'no-such-game' }), []);
    const guest = await service.findAll();
    assert.equal(guest.length, 1);
    assert.equal(guest[0].memberCount, 2);
    assert.equal(guest[0].host.username, 'host');
    assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(guest[0].host)), 'email'), false);
    assert.equal((await service.findAll({}, member)).length, 1);
    const owner = await service.findAll({}, privateHost);
    assert.equal(owner.length, 2);
    assert.equal(owner.find(lobby => lobby.id === privateLobby).memberCount, 1);
    assert.equal(owner.find(lobby => lobby.id === privateLobby).participantLimit, null);
    await runner.query(`DELETE FROM "${schema}".lobby_members WHERE lobby_id = $1 AND user_id = $2`, [publicLobby, member]);
    assert.equal((await service.findAll())[0].memberCount, 1);
    await runner.query(`INSERT INTO "${schema}".lobby_members (id, lobby_id, user_id, role) VALUES ($1, $2, $3, 'member')`, [randomUUID(), publicLobby, member]);
    assert.equal((await service.findAll())[0].memberCount, 2);
    await runner.query(`UPDATE "${schema}".lobbies SET host_id = $1 WHERE id = $2`, [member, publicLobby]);
    await runner.query(`DELETE FROM "${schema}".lobby_members WHERE lobby_id = $1 AND user_id = $2`, [publicLobby, host]);
    await runner.query(`UPDATE "${schema}".lobby_members SET role = 'host' WHERE lobby_id = $1 AND user_id = $2`, [publicLobby, member]);
    assert.equal((await service.findAll())[0].memberCount, 1);
    console.log('Lobby feed PostgreSQL integration checks passed.');
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await db.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
