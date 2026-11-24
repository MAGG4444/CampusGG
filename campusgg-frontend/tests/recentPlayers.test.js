import test from 'node:test'
import assert from 'node:assert/strict'
import { getRecentPlayers } from '../src/api/recentPlayers.js'

const player = { id: 'friend', username: 'player', name: 'Player', relationship: 'none', sharedLobby: 'Ranked lobby', sharedGame: 'Chess', lastSharedAt: '2026-11-24T18:00:00Z', sharedSessions: 2 }
const response = items => ({ ok: true, json: async () => ({ items }) })

test('recent players requests are authenticated and retain shared session metadata', async () => {
  const result = await getRecentPlayers('token', { fetchImpl: async (url, options) => {
    assert.match(url, /\/connections\/recent$/)
    assert.equal(options.headers.Authorization, 'Bearer token')
    return response([player])
  } })
  assert.deepEqual(result, [player])
})
test('empty history is valid but malformed and unauthorized responses fail', async () => {
  assert.deepEqual(await getRecentPlayers('token', { fetchImpl: async () => response([]) }), [])
  for (const items of [null, [{ ...player, sharedSessions: 0 }], [{ ...player, lastSharedAt: 'bad' }], [{ ...player, relationship: 'unknown' }]]) {
    await assert.rejects(getRecentPlayers('token', { fetchImpl: async () => response(items) }), /Invalid recent players/)
  }
  await assert.rejects(getRecentPlayers('token', { fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) }) }), /Unauthorized/)
})
