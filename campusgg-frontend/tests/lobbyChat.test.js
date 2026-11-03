import test from 'node:test'
import assert from 'node:assert/strict'
import { loadLobbyMessages, sendLobbyMessage } from '../src/api/lobbyChat.js'

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
