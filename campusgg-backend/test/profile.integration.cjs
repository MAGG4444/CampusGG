const test = require('node:test');
const assert = require('node:assert/strict');
const { JwtService } = require('@nestjs/jwt');
const { createFixture } = require('./profile-fixture.cjs');

test('profile HTTP API with real PostgreSQL, migrations and JWT authentication', async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  const [alice, bob] = fixture.accounts;
  async function request(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(`${fixture.baseUrl}${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  async function login(account) {
    const result = await request('/api/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
    assert.equal(result.status, 200);
    return result.data.access_token;
  }
  const token = await login(alice);
  const patch = (body, auth = token) => request('/users/me', { method: 'PATCH', token: auth, body });
  await t.test('migration preserves every existing account column and supplies defaults; rerun is a no-op', async () => {
    const after = await fixture.rows();
    for (let i = 0; i < after.length; i++) {
      const { bio, favorite_games, skill_level, ...original } = after[i];
      assert.deepEqual(original, fixture.before[i]);
      assert.equal(bio, ''); assert.deepEqual(favorite_games, []); assert.equal(skill_level, '');
    }
    assert.deepEqual(await fixture.database.runMigrations(), []);
  });
  await t.test('missing, forged and expired JWTs cannot read or update private profiles', async () => {
    const expired = fixture.app.get(JwtService).sign({ sub: alice.id }, { expiresIn: -1 });
    for (const auth of ['', 'invalid', expired]) {
      assert.equal((await patch({ bio: 'Denied' }, auth)).status, 401);
      assert.equal((await request('/users/me', { token: auth })).status, 401);
    }
  });
  await t.test('unknown and account/security fields are rejected before any update', async () => {
    const before = await fixture.rows();
    for (const key of ['id', 'userId', 'username', 'email', 'password', 'eduVerified', 'verificationToken', 'tokenExpiresAt', 'unexpected']) {
      assert.equal((await patch({ bio: 'Must not save', [key]: bob.id })).status, 400, key);
    }
    assert.deepEqual(await fixture.rows(), before);
    assert.equal((await request(`/users/${bob.id}`, { method: 'PATCH', token, body: { bio: 'Denied' } })).status, 404);
  });
  const profile = { displayName: 'Campus Player', bio: 'Weekend squad', favoriteGames: ['Valorant', 'Minecraft'], skillLevel: 'Intermediate' };
  await t.test('validated updates affect only JWT owner and return an explicit safe profile', async () => {
    const result = await patch({ ...profile, displayName: ' Campus Player ', favoriteGames: [' Valorant ', 'Minecraft'] });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: alice.id, username: alice.username, email: alice.email, ...profile });
    const rows = await fixture.rows();
    const other = rows.find((row) => row.id === bob.id);
    for (const [key, value] of Object.entries(fixture.before[1])) assert.deepEqual(other[key], value);
    assert.equal(other.bio, '');
    for (const key of ['email', 'username', 'password', 'edu_verified', 'verification_token', 'token_expires_at']) {
      assert.deepEqual(rows[0][key], fixture.before[0][key]);
    }
  });
  await t.test('partial updates and empty patches preserve omitted fields; optional fields can be cleared', async () => {
    assert.equal((await patch({ bio: 'Updated bio' })).status, 200);
    assert.deepEqual((await patch({})).data, { id: alice.id, username: alice.username, email: alice.email, ...profile, bio: 'Updated bio' });
    const cleared = await patch({ bio: '', favoriteGames: [], skillLevel: '' });
    assert.equal(cleared.data.displayName, profile.displayName);
    assert.equal(cleared.data.bio, ''); assert.deepEqual(cleared.data.favoriteGames, []); assert.equal(cleared.data.skillLevel, '');
    await patch(profile);
  });
  await t.test('invalid input is rejected without changing PostgreSQL', async () => {
    const before = await fixture.rows();
    for (const body of [{ displayName: '' }, { displayName: 'x'.repeat(101) }, { displayName: null },
      { bio: 'x'.repeat(501) }, { bio: null }, { favoriteGames: ['A', ' a '] }, { favoriteGames: [42] },
      { favoriteGames: [''] }, { favoriteGames: ['x'.repeat(51)] }, { favoriteGames: null },
      { favoriteGames: Array.from({ length: 11 }, (_, i) => `game${i}`) }, { skillLevel: 'Expert' }]) {
      assert.equal((await patch(body)).status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await fixture.rows(), before);
  });
  await t.test('authenticated refresh and a fresh sign-in read persisted data; public reads omit private fields', async () => {
    const reLogin = await login(alice);
    for (const auth of [token, reLogin]) {
      assert.deepEqual((await request('/users/me', { token: auth })).data, { id: alice.id, username: alice.username, email: alice.email, ...profile });
    }
    assert.equal((await fixture.rows())[0].bio, profile.bio);
    const publicProfile = (await request(`/users/${alice.id}`)).data;
    assert.deepEqual(publicProfile, { id: alice.id, username: alice.username, ...profile });
    for (const account of (await request('/users')).data) {
      for (const key of ['email', 'password', 'verificationToken', 'tokenExpiresAt', 'eduVerified']) assert.equal(key in account, false);
    }
    const missing = fixture.app.get(JwtService).sign({ sub: '00000000-0000-4000-8000-000000000000' });
    assert.equal((await patch({ bio: 'Missing account' }, missing)).status, 404);
  });
  await t.test('registration, resend, verification and login still work with new profile defaults', async () => {
    const account = { email: 'new@profile-test.edu', username: 'newplayer', displayName: 'New Player', password: alice.password };
    assert.equal((await request('/api/auth/register', { method: 'POST', body: account })).status, 201);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: account.email, password: account.password } })).status, 403);
    assert.equal((await request('/api/auth/resend-verification', { method: 'POST', body: { email: account.email } })).status, 200);
    const code = fixture.mail.at(-1)[2];
    assert.match(code, /^\d{6}$/);
    assert.equal((await request('/api/auth/verify', { method: 'POST', body: { email: account.email, code } })).status, 200);
    const user = (await request('/users/me', { token: await login(account) })).data;
    assert.equal(user.bio, ''); assert.deepEqual(user.favoriteGames, []); assert.equal(user.skillLevel, '');
  });
});
