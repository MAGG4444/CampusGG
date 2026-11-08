import test from 'node:test'
import assert from 'node:assert/strict'
import { filterLobbyFeed, startLobbyFeedSync } from '../src/utils/lobbyFeedSync.js'

function target() {
  const events = new Map()
  return {
    addEventListener(name, fn) { events.set(name, fn) },
    removeEventListener(name) { events.delete(name) },
    fire(name) { events.get(name)?.() },
    events,
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

test('visible sessions refresh on interval and focus, coalesce requests, and abort stale work', async () => {
  const document = { ...target(), visibilityState: 'visible' }
  const window = { ...target(), setTimeout: fn => { window.timer = fn; return 1 }, clearTimeout: () => { window.timer = null } }
  const calls = []
  const applied = []
  const load = signal => new Promise(resolve => calls.push({ signal, resolve }))
    .then(value => { if (!signal.aborted) applied.push(value) })
  const stop = startLobbyFeedSync({ load, onError: () => assert.fail('unexpected error'), document, window })
  await flush()
  window.fire('focus')
  assert.equal(calls.length, 1)
  calls[0].resolve(['created'])
  await flush()
  assert.deepEqual(applied, [['created']])
  window.timer()
  await flush()
  assert.equal(calls.length, 2)
  document.visibilityState = 'hidden'
  document.fire('visibilitychange')
  assert.equal(calls[1].signal.aborted, true)
  document.visibilityState = 'visible'
  document.fire('visibilitychange')
  await flush()
  assert.equal(calls.length, 3)
  calls[2].resolve([])
  calls[1].resolve(['stale'])
  await flush()
  assert.deepEqual(applied, [['created'], []])
  window.fire('focus')
  await flush()
  assert.equal(calls.length, 4)
  stop()
  assert.equal(calls[3].signal.aborted, true)
  assert.equal(document.events.size, 0)
  assert.equal(window.events.size, 0)
})

test('refreshing feed data preserves search and game/skill filters', () => {
  const old = [{ lobbyName: 'Ranked', game: 'Valorant', skillLevel: 'Advanced' }]
  const updated = [...old, { lobbyName: 'Ranked new', game: 'Valorant', skillLevel: 'Advanced' }, { lobbyName: 'Ranked', game: 'CS2', skillLevel: 'Advanced' }]
  const filter = data => filterLobbyFeed(data, 'ranked', 'Valorant', 'Advanced')
  assert.equal(filter(old).length, 1)
  assert.equal(filter(updated).length, 2)
  assert.equal(filter(updated.slice(1)).length, 1)
})

test('capacity filtering is exact and Any retains historical limits', () => {
  const limits = [2, 5, 10, null, 20, 50, 100]
  const lobbies = limits.map(participantLimit => ({ participantLimit, game: 'CS2', skillLevel: 'Advanced', lobbyName: 'Ranked' }))
  for (const [filter, expected] of [['2', 2], ['5', 5], ['10', 10], ['unlimited', null]]) {
    assert.deepEqual(filterLobbyFeed(lobbies, 'ranked', 'CS2', 'Advanced', filter).map(lobby => lobby.participantLimit), [expected])
  }
  assert.equal(filterLobbyFeed(lobbies, 'ranked', 'CS2', 'Advanced', 'any').length, 7)
  assert.equal(filterLobbyFeed(lobbies, 'other', 'CS2', 'Advanced', 'any').length, 0)
})

test('separate visible sessions discover creation and deletion on the next poll', async () => {
  let serverLobbies = []
  const sessions = Array.from({ length: 2 }, () => {
    const document = { ...target(), visibilityState: 'visible' }
    const window = { ...target(), setTimeout: fn => { window.timer = fn; return 1 }, clearTimeout: () => { window.timer = null } }
    const session = { document, window, lobbies: [] }
    session.stop = startLobbyFeedSync({
      document, window,
      load: async () => { session.lobbies = [...serverLobbies] },
      onError: () => assert.fail('unexpected error'),
    })
    return session
  })
  await flush()
  serverLobbies = ['new']
  sessions.forEach(session => session.window.timer())
  await flush()
  assert.deepEqual(sessions.map(session => session.lobbies), [['new'], ['new']])
  serverLobbies = []
  sessions.forEach(session => session.window.timer())
  await flush()
  assert.deepEqual(sessions.map(session => session.lobbies), [[], []])
  sessions.forEach(session => session.stop())
})

test('returning to the feed refreshes immediately and retry recovers without parallel requests', async () => {
  const document = { ...target(), visibilityState: 'visible' }
  const window = { ...target(), setTimeout: fn => { window.timer = fn; return 1 }, clearTimeout: () => { window.timer = null } }
  let server = { id: 'lobby', role: 'member' }
  let state
  let failing = false
  let errors = 0
  let calls = 0
  const load = async () => {
    calls += 1
    if (failing) throw new Error('offline')
    state = server
  }
  const open = () => startLobbyFeedSync({ load, onError: () => { errors += 1 }, document, window })
  let stop = open()
  await flush()
  assert.equal(state.role, 'member')
  stop()
  server = { id: 'lobby', role: 'host' }
  stop = open()
  await flush()
  assert.equal(state.role, 'host')
  failing = true
  window.timer()
  await flush()
  assert.equal(errors, 1)
  assert.equal(state.role, 'host')
  failing = false
  server = null
  stop.refresh()
  stop.refresh()
  await flush()
  assert.equal(state, null)
  assert.equal(calls, 4)
  stop()
})
