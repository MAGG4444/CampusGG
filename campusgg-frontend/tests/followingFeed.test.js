import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('following feed handles sign-in, empty, error retry and results', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.__followingState = { token: null, loading: false, channels: [], error: '', version: 0 }
  let fail = true
  globalThis.__followingRequest = async () => { if (fail) throw Error('offline'); return { posts: [{ id: 'a', title: 'A post', content: 'Text', game: 'CS2' }], total: 1 } }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/FollowingFeed.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const Link = p => React.createElement('a', {href:p.to}, p.children)`))
    replace('/src/components/InfinitePostList.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p => React.createElement('span', null, p.url)`))
    replace('/src/context/forumFollowsContext.js', moduleUrl('export const useForumFollows = () => globalThis.__followingState'))
    replace('/src/api/request.js', moduleUrl('export const request=(...args)=>globalThis.__followingRequest(...args)'))
    replace('/src/components/ForumPost.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p => React.createElement('a', {href:'/forum/'+p.id}, p.title)`))
    replace('/src/utils/forumPost.js', new URL('../src/utils/forumPost.js', import.meta.url).href)
    const { default: Feed } = await import(moduleUrl(source))
    const render = () => React.createElement(Feed, { catalog: [] })
    await act(async () => { renderer = TestRenderer.create(render()); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /Sign in/)
    globalThis.__followingState = { token: 'abc', loading: false, channels: [], error: '', version: 0 }
    await act(async () => renderer.update(render()))
    assert.match(JSON.stringify(renderer.toJSON()), /not following any channels/)
    globalThis.__followingState = { ...globalThis.__followingState, channels: [{ id: 'cs' }] }
    await act(async () => { renderer.update(render()); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /forum\/me\/following\/posts/)
    await act(async () => renderer.unmount())
  } finally {
    delete globalThis.__followingState
    delete globalThis.__followingRequest
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    await server.close()
  }
})
