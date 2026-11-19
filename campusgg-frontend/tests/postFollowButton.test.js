import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('post follow toggles persisted state and isolates accounts', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.__postAuth = { token: 'alice' }
  const calls = []
  globalThis.__postFollow = async (...args) => { calls.push(args); return { following: args[1] } }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/PostFollowButton.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/src/context/useAuth.js', url('export const useAuth=()=>globalThis.__postAuth'))
    replace('/src/api/forum.js', url('export const setPostFollow=(...args)=>globalThis.__postFollow(...args); export const getPostFollowStatuses=()=>Promise.resolve({followedIds:[]})'))
    replace('/src/hooks/useInfiniteForumFeed.js', url('export const invalidateInactiveForumFeeds=()=>{}'))
    const { default: Button } = await import(url(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(Button, { postId: 'one', following: false })) })
    const button = () => renderer.root.findByType('button')
    await act(async () => button().props.onClick())
    assert.deepEqual(calls[0], ['one', true, 'alice'])
    assert.equal(button().props['aria-pressed'], true)
    await act(async () => button().props.onClick())
    assert.deepEqual(calls[1], ['one', false, 'alice'])
    globalThis.__postAuth = { token: 'bob' }
    await act(async () => renderer.update(React.createElement(Button, { postId: 'one', following: false })))
    assert.equal(button().props['aria-pressed'], false)
    await act(async () => button().props.onClick())
    assert.deepEqual(calls[2], ['one', true, 'bob'])
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    delete globalThis.__postAuth; delete globalThis.__postFollow; delete globalThis.IS_REACT_ACT_ENVIRONMENT
    await server.close()
  }
})
