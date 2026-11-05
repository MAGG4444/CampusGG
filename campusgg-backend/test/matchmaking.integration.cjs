// Run after the backend build with DATABASE_URL pointing to a disposable test DB.
// All objects are created in a randomly named schema and removed afterward.
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
  const schema = `test_matchmaking_${randomUUID().replaceAll('-', '')}`;
  const db = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL,
    schema, entities: [User, Lobby, LobbyMember], synchronize: false });
  await db.initialize();
  let created = false;
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await db.synchronize();
    const userRepo = db.getRepository(User);
    const users = await userRepo.save(Array.from({ length: 7 }, (_, i) => ({
      username: `test_${i}`, email: `test_${i}@example.edu`,
    })));
    const service = new LobbiesService(db.getRepository(Lobby), {
      findOne: id => userRepo.findOneByOrFail({ id }),
    });
    const dto = { lobbyName: 'Matched', details: 'Match', tags: [], participantLimit: 2 };
    const lobby = await service.createMatchedLobby(dto, [users[0].id, users[1].id]);
    assert.equal(await db.getRepository(LobbyMember).count({ where: { lobby: { id: lobby.id } } }), 2);

    await assert.rejects(service.createMatchedLobby(dto, [users[2].id, users[1].id]));
    assert.equal(await db.getRepository(Lobby).count(), 1);
    assert.equal(await db.getRepository(LobbyMember).count({ where: { user: { id: users[2].id } } }), 0);

    // A joining transaction holds the user row first, then commits membership while
    // matchmaking waits. The match must observe that committed membership.
    const other = await service.create({ lobbyName: 'Other', details: 'Other', tags: [] }, users[3].id);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.manager.findOneOrFail(User, { where: { id: users[4].id }, lock: { mode: 'pessimistic_write' } });
      const match = service.createMatchedLobby(dto, [users[5].id, users[4].id]);
      // Attach rejection handling immediately, before releasing the competing lock.
      const outcome = match.then(value => ({ value }), error => ({ error }));
      await runner.manager.save(LobbyMember, runner.manager.create(LobbyMember, {
        user: users[4], lobby: other, role: 'member',
      }));
      await runner.commitTransaction();
      assert.ok((await outcome).error);
      assert.equal(await db.getRepository(Lobby).count(), 2);
      assert.equal(await db.getRepository(LobbyMember).count({ where: { user: { id: users[5].id } } }), 0);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }

    // Force a failure after the lobby and host membership have been written.
    // An injected trigger fails the second membership after earlier writes.
    await db.query(`CREATE FUNCTION "${schema}".fail_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id = '${users[6].id}' THEN RAISE EXCEPTION 'test enrollment failure'; END IF; RETURN NEW; END $$`);
    await db.query(`CREATE TRIGGER fail_member BEFORE INSERT ON "${schema}".lobby_members FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_member()`);
    await assert.rejects(service.createMatchedLobby(dto, [users[2].id, users[6].id]));
    assert.equal(await db.getRepository(Lobby).count(), 2);
    assert.equal(await db.getRepository(LobbyMember).count({ where: { user: { id: users[2].id } } }), 0);
    console.log('Matchmaking PostgreSQL integration checks passed.');
  } finally {
    if (created) await db.query(`DROP SCHEMA "${schema}" CASCADE`);
    await db.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
