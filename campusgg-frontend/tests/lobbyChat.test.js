import test from 'node:test'
import assert from 'node:assert/strict'
import { loadLobbyMessages, loadLobbyReadState, markLobbyMessageRead, sendLobbyMessage } from '../src/api/lobbyChat.js'

test('loads messages using the authenticated lobby endpoint', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:3000/lobbies/lobby-a/messages')
    assert.equal(options.headers.Authorization, 'Bearer token')
    return Response.json([{ id: 'message-a' }])
  })
  assert.deepEqual(await loadLobbyMessages('lobby-a', 'token'), [{ id: 'message-a' }])
})

test('sends only message content and reports failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { content: 'hello' })
    return Response.json({ message: 'Membership required' }, { status: 403 })
  })
  await assert.rejects(sendLobbyMessage('lobby-a', 'token', 'hello'), { status: 403, message: 'Membership required' })
  await assert.rejects(loadLobbyMessages('lobby-a', ''), /sign in/)
})

test('read state requests use authenticated lobby-scoped endpoints', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return Response.json({ unreadMessageIds: ['message-a'] })
  })
  assert.deepEqual(await loadLobbyReadState('lobby-a', 'token'), { unreadMessageIds: ['message-a'] })
  await markLobbyMessageRead('lobby-a', 'token', 'message-a')
  assert.equal(calls[0].url, 'http://localhost:3000/lobbies/lobby-a/messages/read-state')
  assert.equal(calls[1].url, 'http://localhost:3000/lobbies/lobby-a/messages/message-a/read')
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[1].options.headers.Authorization, 'Bearer token')
})
