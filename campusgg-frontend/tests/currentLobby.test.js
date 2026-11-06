import test from 'node:test'
import assert from 'node:assert/strict'
import { attemptLobbyJoin, checkCurrentLobby, currentLobbyFromFeed } from '../src/utils/currentLobby.js'

test('current lobby is selected independently of feed filters and disappears on deletion', () => {
  const lobbies = [{ id: 'one', lobbyName: 'Squad', game: 'Valorant' }, { id: 'two', game: 'CS2' }]
  const role = id => id === 'one' ? 'host' : null
  assert.deepEqual(currentLobbyFromFeed(['one'], role, lobbies), { ...lobbies[0], role: 'host' })
  assert.equal(currentLobbyFromFeed([], role, lobbies), null)
  assert.equal(currentLobbyFromFeed(['one'], role, [lobbies[1]]), null)
})

test('join check uses refreshed membership and existing feed data', async () => {
  const lobby = { id: 'one', lobbyName: 'Squad' }
  assert.deepEqual(await checkCurrentLobby(async () => ({ one: 'member' }), [lobby]), { ...lobby, role: 'member' })
  assert.equal(await checkCurrentLobby(async () => ({}), [lobby]), null)
  await assert.rejects(checkCurrentLobby(async () => undefined), /verify your current lobby/)
})

test('direct detail join loads a missing lobby and handles deletion or failed responses', async () => {
  const previous = globalThis.fetch
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 'one', lobbyName: 'Squad' }) })
    assert.equal((await checkCurrentLobby(async () => ({ one: 'host' }))).lobbyName, 'Squad')
    let calls = 0
    globalThis.fetch = async () => ({ ok: false, status: 404 })
    assert.equal(await checkCurrentLobby(async () => ++calls === 1 ? { one: 'host' } : {}), null)
    globalThis.fetch = async () => ({ ok: false, status: 500 })
    await assert.rejects(checkCurrentLobby(async () => ({ one: 'host' })), /Unable to load/)
  } finally { globalThis.fetch = previous }
})

test('cancelled join checks do not return another account’s lobby', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(checkCurrentLobby(async () => ({ one: 'host' }), [], controller.signal), { name: 'AbortError' })
})

test('joining another lobby is blocked and returns the current lobby for navigation', async () => {
  const current = { id: 'one', lobbyName: 'Squad' }
  let joins = 0
  const result = await attemptLobbyJoin({
    lobby: { id: 'two' }, lobbies: [current],
    refreshMemberships: async () => ({ one: 'host' }),
    joinLobby: async () => { joins += 1 },
  })
  assert.deepEqual(result.current, { ...current, role: 'host' })
  assert.equal(joins, 0)
})

test('a membership created concurrently is recovered after a 409, while other conflicts remain errors', async () => {
  const current = { id: 'one', lobbyName: 'Squad' }
  let checks = 0
  const conflict = Object.assign(new Error('Lobby full'), { status: 409 })
  const options = {
    lobby: { id: 'two' }, lobbies: [current],
    refreshMemberships: async () => ++checks === 1 ? {} : { one: 'member' },
    joinLobby: async () => { throw conflict },
  }
  assert.equal((await attemptLobbyJoin(options)).current.id, 'one')
  await assert.rejects(attemptLobbyJoin({ ...options, refreshMemberships: async () => ({}) }), /Lobby full/)
})
