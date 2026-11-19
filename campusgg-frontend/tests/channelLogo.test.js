import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('every channel uses the same gamepad placeholder without an image', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ChannelLogo.jsx')).code
    source = source.replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/node_modules/lucide-react/dist/esm/lucide-react.mjs"', JSON.stringify(import.meta.resolve('lucide-react')))
    const { default: Logo } = await import(moduleUrl(source))
    const channels = ['counter-strike-2', 'dota', 'it-takes-two', 'league-of-legends', 'minecraft', 'overwatch-2', 'rocket-league', 'valorant']
    for (const id of channels) {
      await act(async () => { renderer = TestRenderer.create(React.createElement(Logo, { channel: { id }, small: true })) })
      assert.equal(renderer.root.findAllByType('img').length, 0)
      assert.equal(renderer.root.findByType('svg').props.width, 16)
      assert.match(renderer.root.findByType('span').props.className, /community-logo-small/)
      await act(async () => renderer.unmount())
      renderer = null
    }
  } finally { if (renderer) await act(async () => renderer.unmount()); globalThis.IS_REACT_ACT_ENVIRONMENT = old; await server.close() }
})
