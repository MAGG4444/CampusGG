import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('follow button reflects subscriptions and only changes them on click', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let calls = 0
  globalThis.__followState = { token: 'token', channels: [], loading: false, busy: {}, error: '', toggle: () => { calls += 1 } }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/FollowButton.jsx')).code
    source = source.replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/node_modules/react-router-dom/dist/index.mjs"', JSON.stringify(moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const Link=p=>React.createElement('a',{href:p.to},p.children)`)))
      .replace('"/src/context/forumFollowsContext.js"', JSON.stringify(moduleUrl('export const useForumFollows=()=>globalThis.__followState')))
    const { default: Button } = await import(moduleUrl(source))
    const render = () => React.createElement(Button, { channel: { id: 'v', name: 'Valorant', slug: 'valorant' } })
    await act(async () => { renderer = TestRenderer.create(render()) })
    assert.equal(calls, 0)
    assert.equal(renderer.root.findByType('button').props['aria-pressed'], false)
    await act(async () => renderer.root.findByType('button').props.onClick())
    assert.equal(calls, 1)
    globalThis.__followState = { ...globalThis.__followState, channels: [{ id: 'v' }] }
    await act(async () => renderer.update(render()))
    assert.equal(renderer.root.findByType('button').props['aria-pressed'], true)
    globalThis.__followState = { ...globalThis.__followState, token: null, channels: [] }
    await act(async () => renderer.update(render()))
    assert.equal(renderer.root.findByType('a').props.href, '/signin')
    assert.equal(calls, 1)
    await act(async () => renderer.unmount())
  } finally { delete globalThis.__followState; globalThis.IS_REACT_ACT_ENVIRONMENT = old; await server.close() }
})
