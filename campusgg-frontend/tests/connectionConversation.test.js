import test from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

test('history follows outgoing and nearby incoming messages without interrupting older reading', async () => {
  const oldWindow = globalThis.window
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.window = { matchMedia: () => ({ matches: true }) }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  const calls = []
  const history = { scrollTop: 0, scrollHeight: 1000, clientHeight: 300, scrollTo: options => calls.push(options), getBoundingClientRect: () => ({ top: 0 }) }
  let renderer
  try {
    const { default: Conversation } = await server.ssrLoadModule('/src/components/ConnectionConversation.jsx')
    const messages = [{ id: '1', senderId: 'friend', text: 'Hello', timestamp: 'Now' }]
    const props = { conversation: { id: 'friend', username: 'Friend', messages }, currentUserId: 'me', draft: '', setDraft() {}, sendMessage() {}, onBack() {} }
    await act(async () => { renderer = TestRenderer.create(React.createElement(Conversation, props), { createNodeMock: element => element.props.className === 'chat-history' ? history : null }) })
    assert.equal(history.scrollTop, 1000)
    history.scrollTop = 200
    await act(async () => renderer.root.findByProps({ role: 'log' }).props.onScroll({ currentTarget: history }))
    const incoming = [...messages, { id: '2', senderId: 'friend', text: 'New', timestamp: 'Now' }]
    await act(async () => renderer.update(React.createElement(Conversation, { ...props, conversation: { ...props.conversation, messages: incoming } })))
    assert.equal(calls.length, 0)
    history.scrollTop = 690
    await act(async () => renderer.root.findByProps({ role: 'log' }).props.onScroll({ currentTarget: history }))
    const next = [...incoming, { id: '3', senderId: 'friend', text: 'Another', timestamp: 'Now' }]
    await act(async () => renderer.update(React.createElement(Conversation, { ...props, conversation: { ...props.conversation, messages: next } })))
    assert.deepEqual(calls.at(-1), { top: 1000, behavior: 'auto' })
    history.scrollTop = 100
    await act(async () => renderer.root.findByProps({ role: 'log' }).props.onScroll({ currentTarget: history }))
    const sent = [...next, { id: '4', senderId: 'me', text: 'Reply', timestamp: 'Now' }]
    await act(async () => renderer.update(React.createElement(Conversation, { ...props, conversation: { ...props.conversation, messages: sent } })))
    assert.equal(calls.length, 2)
    assert.deepEqual(calls.at(-1), { top: 1000, behavior: 'auto' })
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.window = oldWindow
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})

test('grouped bubbles show only the last timestamp and retain the unread divider', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  try {
    const { default: Conversation } = await server.ssrLoadModule('/src/components/ConnectionConversation.jsx')
    const messages = [
      { id: '1', senderId: 'a', text: 'First', timestamp: '10:00', createdAt: '2026-11-21T10:00:00Z' },
      { id: '2', senderId: 'a', text: 'Second', timestamp: '10:01', createdAt: '2026-11-21T10:01:00Z' },
      { id: '3', senderId: 'a', text: 'Unread', timestamp: '10:02', createdAt: '2026-11-21T10:02:00Z' },
    ]
    const conversation = { id: 'a', username: 'Avery', messages, unreadMessageIds: ['3'] }
    await act(async () => { renderer = TestRenderer.create(React.createElement(Conversation, { conversation, currentUserId: 'me', draft: '', setDraft() {}, sendMessage() {}, onBack() {} })) })
    assert.deepEqual(renderer.root.findAllByType('time').map(item => item.children[0]), ['10:01', '10:02'])
    assert.equal(renderer.root.findAllByProps({ className: 'chat-unread-divider' }).length, 1)
    assert.equal(renderer.root.findAllByProps({ 'data-message-id': '3' }).length, 1)
    await act(async () => renderer.update(React.createElement(Conversation, { conversation: { ...conversation, unreadMessageIds: [] }, currentUserId: 'me', draft: '', setDraft() {}, sendMessage() {}, onBack() {} })))
    assert.equal(renderer.root.findAllByProps({ className: 'chat-unread-divider' }).length, 0)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})
