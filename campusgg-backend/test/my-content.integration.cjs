const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('./my-content-fixture.cjs');

test('personal content uses verified ownership, pagination and safe summaries', async t => {
  const f = await createFixture();
  t.after(f.close);
  async function get(path, token) {
    const response = await fetch(f.url + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: response.status, body: await response.json() };
  }
  for (const path of ['/forum/posts/me', '/lobbies/me']) {
    await t.test(`${path}: missing, invalid and expired JWTs return 401`, async () => {
      for (const token of [undefined, 'invalid', f.jwt.sign({ sub: f.users[0].id }, { expiresIn: -1 })]) {
        assert.equal((await get(path, token)).status, 401);
      }
    });
    await t.test(`${path}: empty user, bounded pagination, no spoofed ownership`, async () => {
      const empty = await get(path, f.tokens[2]);
      assert.equal(empty.status, 200);
      assert.deepEqual(empty.body, { items: [], total: 0, page: 1, limit: 10 });
      for (const query of ['page=0', 'page=-1', 'page=1.5', 'limit=101', 'limit=0', 'page=999999999999999999']) {
        assert.equal((await get(`${path}?${query}`, f.tokens[0])).status, 400);
      }
      const first = await get(`${path}?limit=1&userId=${f.users[1].id}&authorId=${f.users[1].id}&hostId=${f.users[1].id}`, f.tokens[0]);
      assert.equal(first.status, 200);
      assert.equal(first.body.total, 2);
      assert.equal(first.body.items.length, 1);
      assert.match(first.body.items[0].title, /Newer/);
      assert.deepEqual(Object.keys(first.body.items[0]).sort(), ['createdAt', 'id', 'preview', 'title']);
      assert.ok(first.body.items[0].preview.length <= 240);
      const second = await get(`${path}?page=2&limit=1`, f.tokens[0]);
      assert.match(second.body.items[0].title, /Older/);
      assert.ok(Date.parse(first.body.items[0].createdAt) > Date.parse(second.body.items[0].createdAt));
      assert.deepEqual((await get(`${path}?page=3&limit=1`, f.tokens[0])).body.items, []);
      const other = await get(path, f.tokens[1]);
      assert.equal(other.body.total, 1);
      assert.ok(!other.body.items.some(item => item.id === first.body.items[0].id));
    });
  }
  await t.test('joined lobbies are excluded; private hosted lobbies are included', async () => {
    const result = await get('/lobbies/me', f.tokens[0]);
    assert.deepEqual(result.body.items.map(item => item.id), [f.lobbies[1].id, f.lobbies[0].id]);
  });
  await t.test('public endpoints and existing detail/update/delete operations still work', async () => {
    for (const path of ['/forum/posts', '/lobbies/db', `/forum/posts/${f.posts[0].id}`, `/lobbies/${f.lobbies[0].id}`]) {
      assert.equal((await get(path)).status, 200);
    }
    const url = `${f.url}/forum/posts/${f.posts[0].id}`;
    assert.equal((await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${f.tokens[1]}` } })).status, 403);
    assert.equal((await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${f.tokens[0]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Updated title' }) })).status, 200);
    assert.equal((await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${f.tokens[0]}` } })).status, 200);
    const result = await get('/forum/posts/me', f.tokens[0]);
    assert.equal(result.body.total, 1);
    assert.ok(result.body.items.every(item => item.id !== f.posts[0].id));
  });
});
