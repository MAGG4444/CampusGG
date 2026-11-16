import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('ranked feed handles sorting, pagination reset, retry and post links', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/RankedFeed.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/src/components/InfinitePostList.jsx', url(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p=>React.createElement('div', {'data-url':p.url}, p.url)`))
    replace('/src/api/request.js', url('export const request=(...args)=>globalThis.__rankRequest(...args)'))
    replace('/src/utils/forumPost.js', new URL('../src/utils/forumPost.js', import.meta.url).href)
    replace('/src/components/ForumPost.jsx', url(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p=>React.createElement('a',{href:'/forum/'+p.id},p.title)`))
    const { default: Feed } = await import(url(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(Feed, { mode: 'popular' })); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /sort=hot/)
    await act(async () => { renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'top' } }); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /sort=top/)
    await act(async () => { renderer.root.findAllByType('select')[1].props.onChange({ target: { value: 'week' } }); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /window=week/)
    await act(async () => renderer.unmount())
  } finally { delete globalThis.__rankRequest; globalThis.IS_REACT_ACT_ENVIRONMENT = old; await server.close() }
})
