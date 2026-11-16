import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('feed loader appends, deduplicates, retries, caches and isolates accounts', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const calls = []
  let fail = false
  let releaseSlow
  globalThis.__infiniteRequest = async path => {
    calls.push(path)
    if (path.startsWith('/slow')) return new Promise(resolve => { releaseSlow = resolve })
    if (fail) { const error = Error('Cannot GET feed'); error.status = 404; throw error }
    const page = Number(new URL(path, 'http://localhost').searchParams.get('page'))
    const ids = page === 1 ? Array.from({ length: 20 }, (_, i) => String(i)) : ['19', '20']
    return { posts: ids.map(id => ({ id, title: id, content: 'text' })), total: 22 }
  }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer, state
  try {
    let source = (await server.transformRequest('/src/hooks/useInfiniteForumFeed.js')).code
    source = source.replace('"/node_modules/react/index.js"', JSON.stringify(import.meta.resolve('react')))
      .replace('"/src/api/request.js"', JSON.stringify(url('export const request=(...args)=>globalThis.__infiniteRequest(...args)')))
      .replace('"/src/utils/forumPost.js"', JSON.stringify(new URL('../src/utils/forumPost.js', import.meta.url).href))
    const { useInfiniteForumFeed } = await import(url(source))
    function Probe({ scope, path }) { state = useInfiniteForumFeed(path, scope, scope); return null }
    const render = (scope, path = '/feed') => React.createElement(Probe, { key: scope + path, scope, path })
    await act(async () => { renderer = TestRenderer.create(render('alice')); await tick() })
    assert.equal(state.posts.length, 20); assert.equal(state.hasMore, true)
    fail = true
    await act(async () => { state.more(); await tick() })
    assert.match(state.error, /endpoint not found \(404\)/); assert.equal(state.posts.length, 20)
    fail = false
    await act(async () => { state.retry(); await tick() })
    assert.equal(state.posts.length, 21); assert.equal(state.hasMore, false)
    assert.equal(new Set(state.posts.map(post => post.id)).size, 21)
    await act(async () => renderer.unmount())
    const count = calls.length
    await act(async () => { renderer = TestRenderer.create(render('alice')); await tick() })
    assert.equal(state.posts.length, 21); assert.equal(calls.length, count)
    await act(async () => { renderer.update(render('bob')); await tick() })
    assert.equal(state.posts.length, 20); assert.equal(state.page, 1)
    await act(async () => { renderer.update(render('bob', '/slow')); await tick() })
    await act(async () => { renderer.update(render('bob', '/new-sort')); await tick() })
    await act(async () => { releaseSlow({ posts: [{ id: 'stale', title: 'stale' }], total: 1 }); await tick() })
    assert.ok(!state.posts.some(post => post.id === 'stale'))
    assert.equal(state.page, 1); assert.match(calls.at(-1), /new-sort/)
    await act(async () => renderer.unmount())
  } finally { delete globalThis.__infiniteRequest; globalThis.IS_REACT_ACT_ENVIRONMENT = old; await server.close() }
})
