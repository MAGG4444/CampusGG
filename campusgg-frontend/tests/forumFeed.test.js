import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const react = JSON.stringify(import.meta.resolve('react'))

test('home sends search and sorting to the combined public feed', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ForumFeed.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/src/components/SearchBar.jsx', url(`import React from ${react}; export default p=>React.createElement('input',{value:p.value,onChange:e=>p.onChange(e.target.value)})`))
    replace('/src/components/InfinitePostList.jsx', url(`import React from ${react}; export default p=>React.createElement('div',{'data-url':p.url,'data-refresh':p.showRefresh})`))
    replace('/src/components/ForumSort.jsx', url(`import React from ${react}; export default p=>React.createElement('button',{onClick:()=>p.onChange('followed')},p.value)`))
    replace('/src/components/ForumTableHeader.jsx', url(`import React from ${react}; export default ()=>React.createElement('div',{className:'forum-table-header'},'Title','Poster','Time','Replies','Follow')`))
    replace('/src/components/ForumStickyHeader.jsx', url(`import React from ${react}; export default p=>React.createElement('div',{className:'forum-sticky-header'},p.children)`))
    replace('/src/context/useAuth.js', url('export const useAuth=()=>({token:null})'))
    replace('/node_modules/react-router-dom/dist/index.mjs', url(`import React from ${react}; export const Link=p=>React.createElement('a',{href:p.to},p.children)`))
    const { default: Feed } = await import(url(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(Feed, { channels: [{ id: 'cs', slug: 'cs2', name: 'CS2' }] })) })
    const feed = () => renderer.root.findAllByType('div').find(node => node.props['data-url'])
    assert.equal(renderer.root.findByType('a').props.href, '/create-post')
    assert.equal(renderer.root.findByProps({ className: 'forum-sticky-header' }).findByProps({ className: 'forum-table-header' }).children.join(','), 'Title,Poster,Time,Replies,Follow')
    assert.match(feed().props['data-url'], /sort=new/)
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'strategy' } }))
    assert.equal(renderer.root.findAllByProps({ id: 'forum-home-game' }).length, 0)
    await act(async () => renderer.root.findByType('button').props.onClick())
    assert.match(feed().props['data-url'], /sort=followed&search=strategy/)
    assert.equal(feed().props['data-refresh'], false)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = old
    await server.close()
  }
})

test('forum header is sticky above a naturally flowing list with shared columns', async () => {
  const css = await readFile(new URL('../src/pages/Forum.css', import.meta.url), 'utf8')
  const header = css.match(/\.forum-sticky-header\s*\{([^}]*)\}/)?.[1] || ''
  assert.match(header, /position:\s*sticky/)
  assert.match(header, /top:\s*var\(--connection-sidebar-top/)
  assert.match(header, /background-image:\s*var\(--app-page-background\)/)
  assert.doesNotMatch(css.match(/\.forum-feed-list\s*\{([^}]*)\}/)?.[1] || '', /overflow|max-height|height\s*:/)
  assert.match(css, /\.forum-table-header,\s*\.forum-post-card\s*\{[^}]*grid-template-columns:\s*var\(--discussion-columns\)/)
})
