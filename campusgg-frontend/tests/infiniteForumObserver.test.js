import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('sentinel requires leaving the threshold before another automatic load', async () => {
  const old = { act: globalThis.IS_REACT_ACT_ENVIRONMENT, observer: globalThis.IntersectionObserver }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let trigger, loads = 0
  globalThis.IntersectionObserver = class { constructor(callback) { trigger = callback } observe() {} disconnect() {} }
  globalThis.__infiniteState = { posts: [{ id: 'a', title: 'A' }], page: 1, loading: false, error: false, hasMore: true, more: () => { loads += 1 }, refresh() {}, retry() {} }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/InfinitePostList.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/src/utils/channelPresentation.js', new URL('../src/utils/channelPresentation.js', import.meta.url).href)
    replace('/src/hooks/useInfiniteForumFeed.js', url('export const useInfiniteForumFeed=()=>globalThis.__infiniteState'))
    replace('/src/components/ForumPost.jsx', url('export default function Post(){ return null }'))
    const { default: List } = await import(url(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(List, { url: '/feed', scope: 'guest' }), { createNodeMock: () => ({}) }) })
    await act(async () => { trigger([{ isIntersecting: true }]); trigger([{ isIntersecting: true }]) })
    assert.equal(loads, 1)
    await act(async () => { trigger([{ isIntersecting: false }]); trigger([{ isIntersecting: true }]) })
    assert.equal(loads, 2)
    await act(async () => renderer.unmount())
  } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = old.act; globalThis.IntersectionObserver = old.observer; delete globalThis.__infiniteState; await server.close() }
})
