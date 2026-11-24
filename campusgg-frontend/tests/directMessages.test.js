import test from 'node:test'
import assert from 'node:assert/strict'
import { listConversations, getHistory, postMessage, readMessages } from '../src/api/directMessages.js'
const row = { id: 'm', senderId: 'a', recipientId: 'b', content: 'Hello', createdAt: '2026-11-24T20:00:00Z', readAt: null }
const response = data => ({ ok: true, json: async () => data })
test('conversation mapping preserves unread count without inventing online state', async () => {
  const items = await listConversations('token', { fetchImpl: async (url, options) => {
    assert.match(url, /\/direct-messages$/); assert.equal(options.headers.Authorization, 'Bearer token')
    return response({ items: [{ id: 'b', user: { id: 'b', username: 'player', displayName: 'Player' }, lastMessage: row, unreadCount: 2 }] })
  } })
  assert.equal(items[0].lastMessage, 'Hello'); assert.equal(items[0].unreadCount, 2); assert.equal(items[0].online, undefined)
})
test('history preserves sender and cursor and converts content to text', async () => {
  const page = await getHistory('token', 'b', { before: 'older', fetchImpl: async url => {
    assert.match(url, /before=older/); return response({ items: [row], nextBefore: 'next' })
  } })
  assert.equal(page.items[0].text, 'Hello'); assert.equal(page.items[0].senderId, 'a'); assert.equal(page.nextBefore, 'next')
})
test('send and read use recipient-scoped routes and only intended payloads', async () => {
  await postMessage('token', 'b', 'Hello', { fetchImpl: async (url, options) => { assert.match(url, /\/direct-messages\/b$/); assert.equal(options.method, 'POST'); assert.deepEqual(JSON.parse(options.body), { content: 'Hello' }); return response(row) } })
  await readMessages('token', 'b', ['m'], { fetchImpl: async (url, options) => { assert.match(url, /\/b\/read$/); assert.equal(options.method, 'PATCH'); assert.deepEqual(JSON.parse(options.body), { messageIds: ['m'] }); return response({ updated: 1 }) } })
})
test('malformed or forbidden responses are not treated as empty success', async () => {
  await assert.rejects(listConversations('token', { fetchImpl: async () => response({ items: null }) }), /Invalid/)
  await assert.rejects(getHistory('token', 'b', { fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ message: 'Friends only' }) }) }), /Friends only/)
})
