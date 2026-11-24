"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_crypto_1 = require("node:crypto");
const node_assert_1 = require("node:assert");
const typeorm_1 = require("typeorm");
const add_shared_lobby_history_1 = require("../dist/database/migrations/add-shared-lobby-history");
const recent_players_1 = require("../dist/connections/recent-players");
// Run only against a local database. All DDL and data are isolated in a
// randomly named schema, inside a transaction that is always rolled back.
async function main() {
    const url = process.env.DATABASE_URL;
    if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
        throw new Error('A local DATABASE_URL is required; do not run against production.');
    }
    const schema = `campusgg_history_test_${(0, node_crypto_1.randomUUID)().replace(/-/g, '')}`;
    const dataSource = new typeorm_1.DataSource({ type: 'postgres', url, schema, synchronize: false, entities: [] });
    await dataSource.initialize();
    const runner = dataSource.createQueryRunner();
    try {
        await runner.connect();
        await runner.startTransaction();
        const s = dataSource.driver.escape(schema);
        await runner.query(`CREATE SCHEMA ${s}`);
        await runner.query(`CREATE TABLE ${s}.users (id uuid PRIMARY KEY, username text NOT NULL,
      display_name text, bio text, gaming_profiles jsonb NOT NULL DEFAULT '[]', edu_verified boolean NOT NULL)`);
        await runner.query(`CREATE TABLE ${s}.lobbies (id uuid PRIMARY KEY, lobby_name varchar(60) NOT NULL, game varchar(50))`);
        await runner.query(`CREATE TABLE ${s}.lobby_members (lobby_id uuid REFERENCES ${s}.lobbies(id) ON DELETE CASCADE,
      user_id uuid REFERENCES ${s}.users(id) ON DELETE CASCADE, joined_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(lobby_id,user_id), UNIQUE(user_id))`);
        await runner.query(`CREATE TABLE ${s}.connections (pair_key text PRIMARY KEY, requester_id uuid NOT NULL, status text NOT NULL)`);
        const [a, b, c, d, lobby1, lobby2] = Array.from({ length: 6 }, () => (0, node_crypto_1.randomUUID)());
        for (const [id, name, verified] of [[a, 'alpha', true], [b, 'beta', true], [c, 'gamma', true], [d, 'delta', false]]) {
            await runner.query(`INSERT INTO ${s}.users(id,username,edu_verified) VALUES ($1,$2,$3)`, [id, name, verified]);
        }
        const join = async (lobby, user) => { await runner.query(`INSERT INTO ${s}.lobby_members(lobby_id,user_id) VALUES ($1,$2)`, [lobby, user]); };
        const leave = async (user) => { await runner.query(`DELETE FROM ${s}.lobby_members WHERE user_id=$1`, [user]); };
        const history = async (user) => runner.query((0, recent_players_1.recentPlayersSql)(s), [user]);
        await runner.query(`INSERT INTO ${s}.lobbies VALUES ($1,'First lobby','Chess')`, [lobby1]);
        await join(lobby1, a);
        await join(lobby1, b);
        await new add_shared_lobby_history_1.AddSharedLobbyHistory1792368015000().up(runner);
        node_assert_1.strict.equal((await history(a))[0]?.id, b, 'Backfill should include existing overlapping members');
        node_assert_1.strict.equal((await history(b))[0]?.id, a, 'History should be mutual');
        await leave(a);
        await join(lobby1, c);
        node_assert_1.strict.deepEqual((await history(a)).map(x => x.id), [b], 'Non-overlapping players must not appear');
        node_assert_1.strict.equal((await history(c))[0]?.id, b);
        await leave(c);
        await join(lobby1, a);
        node_assert_1.strict.equal((await history(a))[0]?.sharedSessions, 1, 'Rejoin must not count as another lobby');
        await join(lobby1, d);
        node_assert_1.strict.deepEqual((await history(a)).map(x => x.id), [b], 'Unverified users must be excluded');
        await runner.query(`DELETE FROM ${s}.lobbies WHERE id=$1`, [lobby1]);
        node_assert_1.strict.equal((await history(a))[0]?.sharedLobby, 'First lobby', 'Deleting a lobby must preserve history');
        await runner.query(`INSERT INTO ${s}.lobbies VALUES ($1,'Second lobby','Go')`, [lobby2]);
        await join(lobby2, a);
        await join(lobby2, b);
        const pair = [a, b].sort().join(':');
        await runner.query(`INSERT INTO ${s}.connections VALUES ($1,$2,'pending')`, [pair, a]);
        node_assert_1.strict.equal((await history(a))[0]?.relationship, 'outgoing');
        node_assert_1.strict.equal((await history(b))[0]?.relationship, 'incoming');
        await runner.query(`UPDATE ${s}.connections SET status='accepted' WHERE pair_key=$1`, [pair]);
        const row = (await history(a))[0];
        node_assert_1.strict.equal(row?.relationship, 'friend');
        node_assert_1.strict.equal(row?.sharedSessions, 2);
        node_assert_1.strict.equal(row?.sharedLobby, 'Second lobby');
        node_assert_1.strict.equal(row?.sharedGame, 'Go');
        await runner.query(`DELETE FROM ${s}.users WHERE id=$1`, [b]);
        node_assert_1.strict.equal((await history(a)).length, 0, 'Account deletion must remove the related history');
        console.log('PASS: backfill, mutual history, non-overlap, deduplication, verification, persistence, relationship states, account deletion');
    }
    finally {
        try {
            if (runner.isTransactionActive)
                await runner.rollbackTransaction();
        }
        finally {
            try {
                await runner.release();
            }
            finally {
                await dataSource.destroy();
            }
        }
    }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
