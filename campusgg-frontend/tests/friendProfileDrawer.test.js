import test from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

test('profile drawer closes on Escape and restores focus', async () => {
  const oldDocument = globalThis.document
  const oldFrame = globalThis.requestAnimationFrame
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  const listeners = new Map()
  globalThis.document = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), querySelector: () => null }
  globalThis.requestAnimationFrame = fn => fn()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  let closed = 0
  let restored = 0
  try {
    const { default: Drawer } = await server.ssrLoadModule('/src/components/FriendProfileDrawer.jsx')
    await act(async () => { renderer = TestRenderer.create(React.createElement(Drawer, { open: true, person: { name: 'Test Player', username: 'testplayer' }, onClose: () => { closed += 1 }, returnFocusRef: { current: { focus: () => { restored += 1 } } } }), { createNodeMock: () => ({ focus() {} }) }) })
    assert.equal(renderer.root.findByProps({ id: 'connection-profile-drawer' }).props['aria-hidden'], false)
    await act(async () => listeners.get('keydown')({ key: 'Escape', defaultPrevented: false, preventDefault() {} }))
    assert.equal(closed, 1)
    assert.equal(restored, 1)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.document = oldDocument
    globalThis.requestAnimationFrame = oldFrame
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})
