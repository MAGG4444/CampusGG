import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

test('manual scrolling marks viewed unread messages without marking the initial view', async () => {
  const original = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, IntersectionObserver: globalThis.IntersectionObserver, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const requests = []
  const messages = ['first', 'second'].map((id) => ({
    id, content: id, createdAt: '2026-01-01T00:00:00Z', sender: { id: 'other', username: 'Other' },
  }))
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' })
    return { ok: true, json: async () => url.endsWith('/read-state') ? { unreadMessageIds: ['first', 'second'] } : url.endsWith('/read') ? { success: true } : messages }
  }
  const observers = []
  globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe() {}
    disconnect() {}
  }
  const targets = messages.map(({ id }) => ({ dataset: { messageId: id } }))
  const history = {
    scrollHeight: 1000, scrollTop: 300, clientHeight: 200, offsetTop: 0,
    querySelectorAll: () => targets, querySelector: () => null, scrollTo() {},
  }
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  try {
    const transformed = await server.transformRequest('/src/components/LobbyChat.jsx')
    const source = transformed.code
      .replace(/"\/node_modules\/\.vite\/deps\/react\.js\?[^"]+"/g, JSON.stringify(import.meta.resolve('react')))
      .replace(/"\/node_modules\/\.vite\/deps\/react_jsx-dev-runtime\.js\?[^"]+"/g, JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace(/"\/node_modules\/\.vite\/deps\/lucide-react\.js\?[^"]+"/g, JSON.stringify(import.meta.resolve('lucide-react')))
      .replace('"/src/api/lobbyChat.js"', JSON.stringify(new URL('../src/api/lobbyChat.js', import.meta.url).href))
      .replace('"/src/utils/lobbyChatView.js"', JSON.stringify(new URL('../src/utils/lobbyChatView.js', import.meta.url).href))
    const { default: LobbyChat } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    globalThis.window = globalThis
    globalThis.document = { visibilityState: 'visible' }
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(LobbyChat, { lobbyId: 'lobby', token: 'token', isMember: true, userId: 'self' }), {
        createNodeMock: (element) => element.props.role === 'log' ? history : element.type === 'textarea' ? { style: {}, scrollHeight: 20 } : {},
      })
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    assert.equal(requests.filter(request => request.method === 'POST').length, 0)
    assert.equal(observers.length, 0)
    const log = renderer.root.findByProps({ role: 'log' })
    await act(async () => {
      log.props.onWheel()
      history.scrollTop = 250
      log.props.onScroll()
    })
    assert.ok(observers.length > 0)
    await act(async () => {
      observers.at(-1).callback([{ isIntersecting: true, target: targets[0] }])
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    assert.deepEqual(requests.filter(request => request.method === 'POST').map(request => request.url), ['http://localhost:3000/lobbies/lobby/messages/first/read'])
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.window = original.window
    globalThis.document = original.document
    globalThis.fetch = original.fetch
    globalThis.IntersectionObserver = original.IntersectionObserver
    globalThis.IS_REACT_ACT_ENVIRONMENT = original.act
  }
})
