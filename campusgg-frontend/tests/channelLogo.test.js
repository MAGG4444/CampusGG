import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('channel logo uses local artwork and falls back when it fails', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ChannelLogo.jsx')).code
    source = source.replace('"/node_modules/react/index.js"', JSON.stringify(import.meta.resolve('react')))
      .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/node_modules/lucide-react/dist/esm/lucide-react.mjs"', JSON.stringify(import.meta.resolve('lucide-react')))
      .replace('"/src/utils/channelPresentation.js"', JSON.stringify(moduleUrl('export const channelPresentation = { example: { logo: "example.svg" } }')))
    const { default: Logo } = await import(moduleUrl(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(Logo, { channel: { id: 'example', name: 'Example' } })) })
    const img = renderer.root.findByType('img')
    assert.match(img.props.src, /example\.svg$/)
    assert.equal(img.props.alt, 'Example logo')
    await act(async () => img.props.onError())
    assert.equal(renderer.root.findAllByType('img').length, 0)
    await act(async () => renderer.unmount())
  } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = old; await server.close() }
})
