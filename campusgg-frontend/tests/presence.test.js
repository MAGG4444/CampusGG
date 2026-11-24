import test from 'node:test'
import assert from 'node:assert/strict'
import { getFriendPresence } from '../src/api/presence.js'

test('presence requests are authenticated and preserve offline versus unknown', async () => {
  const statuses = await getFriendPresence('jwt', { fetchImpl: async (url, options) => {
    assert.match(url, /\/presence\/friends$/)
    assert.equal(options.headers.Authorization, 'Bearer jwt')
    return { ok: true, json: async () => ({ items: [{ userId: 'a', online: true }, { userId: 'b', online: false }, { userId: 'c', online: null }] }) }
  } })
  assert.equal(statuses.get('a'), true)
  assert.equal(statuses.get('b'), false)
  assert.equal(statuses.has('c'), false)
})
test('invalid presence responses are rejected rather than treated as offline', async () => {
  await assert.rejects(getFriendPresence('jwt', { fetchImpl: async () => ({ ok: true, json: async () => ({ items: [{ userId: 'a', online: 'false' }] }) }) }), /Invalid presence/)
})
