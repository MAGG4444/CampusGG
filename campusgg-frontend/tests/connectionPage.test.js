import test from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

test('Connection shows two tabs and real recommendations in discovery', async () => {
  const originalFetch = globalThis.fetch
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.fetch = async url => ({ ok: true, json: async () => ({ items: String(url).includes('/connections') ? [] : [
    { user: { id: '1', username: 'player', displayName: 'Player One', game: 'Chess', preferredRoles: [], bio: 'Hello' }, reasons: [] },
    { user: { id: '2', username: 'other', displayName: 'Other Player', game: 'Go', preferredRoles: [] }, reasons: [] },
  ] }) })
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  try {
    const { default: Chat } = await server.ssrLoadModule('/src/pages/Chat.jsx')
    const { AuthContext } = await server.ssrLoadModule('/src/context/authContext.js')
    const { ChatContext } = await server.ssrLoadModule('/src/context/chatContext.js')
    await act(async () => { renderer = TestRenderer.create(React.createElement(MemoryRouter, null,
      React.createElement(AuthContext.Provider, { value: { isAuthenticated: true, token: 'token' } },
        React.createElement(ChatContext.Provider, { value: { chatConversations: [], selectConversation() {} } }, React.createElement(Chat))))) })
    const nav = renderer.root.findByProps({ 'aria-label': 'Connection sections' })
    assert.equal(nav.findAllByType('button').length, 2)
    assert.match(JSON.stringify(renderer.toJSON()), /Find a friend to start a conversation/)
    assert.equal(renderer.root.findAllByType('input').length, 0)
    assert.equal(renderer.root.findByProps({ className: 'connection-list-content' }).findAllByType('h2').length, 0)
    await act(async () => nav.findAllByType('button')[1].props.onClick())
    assert.match(JSON.stringify(renderer.toJSON()), /No friends yet/)
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Jump to friends by letter' }).findAllByType('button').length, 27)
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Search Friends' }).props.disabled, false)
    await act(async () => { renderer.root.findByProps({ 'aria-label': 'Find Friends' }).props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.match(JSON.stringify(renderer.toJSON()), /Enter at least 2 characters to search/)
    await act(async () => renderer.root.findAllByType('button').find(item => item.props['aria-label'] === 'Received Requests').props.onClick())
    assert.match(JSON.stringify(renderer.toJSON()), /No pending requests/)
    await act(async () => renderer.root.findAllByType('button').find(item => item.props['aria-label'] === 'Sent Requests').props.onClick())
    assert.match(JSON.stringify(renderer.toJSON()), /No pending requests/)
    await act(async () => renderer.root.findAllByType('button').find(item => item.children.includes('Close')).props.onClick())
    await act(async () => renderer.root.findAllByProps({ className: 'find-friends-person' })[0].props.onClick())
    assert.match(JSON.stringify(renderer.toJSON()), /Hello/)
    assert.equal(renderer.root.findAllByType('button').find(button => button.children.includes('Add Friend')).props.disabled, false)
    assert.match(renderer.root.findByProps({ 'aria-label': 'Connection details' }).props.className, /connection-detail/)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Back to friends' }).props.onClick())
    assert.match(renderer.root.findByProps({ 'aria-label': 'Connection details' }).props.className, /active-chat-panel-mobile-hidden/)
    await act(async () => nav.findAllByType('button')[0].props.onClick())
    assert.equal(nav.findAllByType('button')[0].props['aria-current'], 'page')
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.fetch = originalFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct
  }
})

test('suggestion errors and invalid responses never become empty success states', async () => {
  const originalFetch = globalThis.fetch
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let attempts = 0
  globalThis.fetch = async url => { if (String(url).includes('/connections')) return { ok: true, json: async () => ({ items: [] }) }; attempts += 1; if (attempts === 1) throw new Error('network'); return { ok: true, json: async () => ({ items: null }) } }
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  try {
    const { default: Chat } = await server.ssrLoadModule('/src/pages/Chat.jsx')
    const { AuthContext } = await server.ssrLoadModule('/src/context/authContext.js')
    const { ChatContext } = await server.ssrLoadModule('/src/context/chatContext.js')
    await act(async () => { renderer = TestRenderer.create(React.createElement(MemoryRouter, null, React.createElement(AuthContext.Provider, { value: { isAuthenticated: true, token: 'test-token' } }, React.createElement(ChatContext.Provider, { value: { chatConversations: [], selectConversation() {} } }, React.createElement(Chat))))) })
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Connection sections' }).findAllByType('button')[1].props.onClick())
    await act(async () => { renderer.root.findByProps({ 'aria-label': 'Find Friends' }).props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.match(renderer.root.findByProps({ role: 'alert' }).children.join(' '), /Could not load/)
    await act(async () => { renderer.root.findByProps({ role: 'alert' }).findByType('button').props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.match(renderer.root.findByProps({ role: 'alert' }).children.join(' '), /Could not load/)
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /No suggested players found/)
    assert.equal(attempts, 2)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.fetch = originalFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct
  }
})

test('discovery requests suggestions for the active profile game and refetches on switch', async () => {
  const originalFetch = globalThis.fetch
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const urls = []
  globalThis.fetch = async url => {
    const value = String(url)
    if (value.includes('/connections')) return { ok: true, json: async () => ({ items: [] }) }
    urls.push(value)
    const game = new URL(value).searchParams.get('game')
    return { ok: true, json: async () => ({ items: [], game, needsProfile: false }) }
  }
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  try {
    const { default: Chat } = await server.ssrLoadModule('/src/pages/Chat.jsx')
    const { AuthContext } = await server.ssrLoadModule('/src/context/authContext.js')
    const { ChatContext } = await server.ssrLoadModule('/src/context/chatContext.js')
    const user = { id: 'viewer', gamingProfiles: [{ game: 'League of Legends' }, { game: 'Dota 2' }] }
    await act(async () => { renderer = TestRenderer.create(React.createElement(MemoryRouter, null,
      React.createElement(AuthContext.Provider, { value: { isAuthenticated: true, token: 'token', user } },
        React.createElement(ChatContext.Provider, { value: { chatConversations: [], selectConversation() {} } }, React.createElement(Chat))))) })
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Connection sections' }).findAllByType('button')[1].props.onClick())
    await act(async () => { renderer.root.findByProps({ 'aria-label': 'Find Friends' }).props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.match(urls[0], /\/recommendations\/users\?game=League\+of\+Legends&limit=20/)
    const select = renderer.root.findByProps({ 'aria-label': 'Suggested players game' })
    await act(async () => { select.props.onChange({ target: { value: 'Dota 2' } }); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.match(urls.at(-1), /\/recommendations\/users\?game=Dota\+2&limit=20/)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.fetch = originalFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct
  }
})
