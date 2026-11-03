import test from 'node:test'
import assert from 'node:assert/strict'
import { appendChatMessage, markConversationRead, updateChatDraft } from '../src/utils/chatState.js'

test('opening a conversation clears only its unread indicator', () => {
  const conversations = [{ id: 'a', unreadCount: 3 }, { id: 'b', unreadCount: 2 }]
  const result = markConversationRead(conversations, 'a')
  assert.equal(result[0].unreadCount, 0)
  assert.equal(result[1].unreadCount, 2)
  assert.equal(conversations[0].unreadCount, 3)
})

test('ten local sends append ten messages without changing other conversations', () => {
  let conversations = [{ id: 'a', messages: [] }, { id: 'b', messages: [] }]
  for (let index = 0; index < 10; index += 1) {
    conversations = appendChatMessage(conversations, 'a', { text: `message ${index}` })
  }
  assert.equal(conversations[0].messages.length, 10)
  assert.equal(conversations[1].messages.length, 0)
})

test('drafts remain independent across conversation changes and sending', () => {
  let drafts = updateChatDraft({}, 'a', 'unsent')
  drafts = updateChatDraft(drafts, 'b', 'another')
  drafts = updateChatDraft(drafts, 'b', '')
  assert.deepEqual(drafts, { a: 'unsent', b: '' })
  assert.equal(updateChatDraft(drafts, null, 'ignored'), drafts)
})

test('sending updates only the selected conversation and preserves its history', () => {
  const conversations = [{ id: 'a', messages: [{ text: 'earlier' }] }, { id: 'b', messages: [] }]
  const result = appendChatMessage(conversations, 'a', { text: 'hello' })
  assert.deepEqual(result[0].messages.map((item) => item.text), ['earlier', 'hello'])
  assert.equal(result[0].lastMessage, 'hello')
  assert.equal(result[1], conversations[1])
  assert.equal(conversations[0].messages.length, 1)
})
