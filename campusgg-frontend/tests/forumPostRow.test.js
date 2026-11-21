import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const react = JSON.stringify(import.meta.resolve('react'))

test('feed row contains title, poster, time and replies without post content', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  const oldWindow = globalThis.window
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.window = { getSelection: () => ({ isCollapsed: true }) }
  globalThis.__rowNavigation = []
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ForumPost.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/react-router-dom/dist/index.mjs', url(`import React from ${react}; export const useLocation=()=>({pathname:'/forum/channel/valorant',search:'?sort=new'}); export const useNavigate=()=>(path,options)=>globalThis.__rowNavigation.push({path,...options}); export const Link=p=>React.createElement('a',{href:p.to,title:p.title,'aria-label':p['aria-label'],onClick:p.onClick,'data-origin':p.state?.fromForum},p.children)`))
    replace('/src/context/useAuth.js', url('export const useAuth=()=>({token:"user"})'))
    replace('/src/components/PostFollowButton.jsx', url(`import React from ${react}; export default ()=>React.createElement('button',null,'Follow Post')`))
    replace('/src/utils/forumFeedReturn.js', url('export const rememberForumFeed=()=>{}'))
    const { default: Post } = await import(url(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(Post, { id: 'post-1', title: 'A title', summary: 'Secret excerpt', author: 'Author', createdAt: '2026-01-01T00:00:00Z', replyCount: 12, followed: false })) })
    const output = JSON.stringify(renderer.toJSON())
    assert.match(output, /A title/)
    assert.doesNotMatch(output, /Secret excerpt/)
    assert.match(output, /Author/)
    assert.match(output, /12 replies/)
    assert.equal(renderer.root.findByType('a').props.href, '/forum/post-1')
    assert.equal(renderer.root.findByType('a').props['aria-label'], 'A title')
    assert.equal(renderer.root.findByType('a').props['data-origin'], '/forum/channel/valorant?sort=new')
    assert.equal(renderer.root.findAllByType('time')[0].props.dateTime, '2026-01-01T00:00:00Z')
    assert.equal(renderer.root.findByType('button').children[0], 'Follow Post')
    const row = renderer.root.findByProps({ role: 'row' })
    const rowElement = { contains: () => true, closest: () => null }
    await act(async () => row.props.onClick({ target: { closest: () => null }, currentTarget: rowElement }))
    assert.deepEqual(globalThis.__rowNavigation, [{path:'/forum/post-1',state:{fromForum:'/forum/channel/valorant?sort=new'}}])
    let stopped = false
    renderer.root.findByProps({ className: 'forum-post-follow' }).props.onClick({ target: { closest: () => ({}) }, stopPropagation: () => { stopped = true } })
    assert.equal(stopped, true)
    await act(async () => row.props.onClick({ target: { closest: () => ({}) }, currentTarget: rowElement }))
    assert.equal(globalThis.__rowNavigation.length, 1)
    globalThis.window.getSelection = () => ({ isCollapsed: false, anchorNode: {} })
    await act(async () => row.props.onClick({ target: { closest: () => null }, currentTarget: rowElement }))
    assert.equal(globalThis.__rowNavigation.length, 1)
    let prevented = false
    renderer.root.findByType('a').props.onClick({ currentTarget: { closest: () => rowElement }, preventDefault: () => { prevented = true } })
    assert.equal(prevented, true)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = old
    globalThis.window = oldWindow
    delete globalThis.__rowNavigation
    await server.close()
  }
})
