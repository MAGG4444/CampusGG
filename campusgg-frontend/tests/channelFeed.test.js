import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('channel direct route handles loading and invalid channels', async () => {
  const originalFetch = globalThis.fetch
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ChannelFeed.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/src/components/InfinitePostList.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p=>React.createElement('div',{'data-url':p.url})`))
    replace('/src/components/SearchBar.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p=>React.createElement('input',{placeholder:p.placeholder,value:p.value,onChange:e=>p.onChange(e.target.value)})`))
    replace('/src/components/ForumSort.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p=>React.createElement('button',{className:'forum-sort-toggle',onClick:()=>p.onChange('followed')},p.value==='new'?'Newest':'Most Followed')`))
    replace('/src/components/ForumTableHeader.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default function Header(){return React.createElement('div',{className:'forum-table-header'})}`))
    replace('/src/components/ForumStickyHeader.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p=>React.createElement('div',{className:'forum-sticky-header'},p.children)`))
    replace('/src/components/FollowButton.jsx', moduleUrl('export default function Follow(){ return null }'))
    replace('/src/context/forumFollowsContext.js', moduleUrl('export const useForumFollows = () => null'))
    replace('/src/components/ChannelLogo.jsx', moduleUrl('export default function Logo(){return null}'))
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const useNavigate = () => () => {}; export const Link = p => React.createElement('a', {href:p.to}, p.children)`))
    replace('/src/components/ForumPost.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p => React.createElement('a', {href:'/forum/'+p.id}, p.title)`))
    replace('/src/utils/forumPost.js', new URL('../src/utils/forumPost.js', import.meta.url).href)
    const { default: ChannelFeed } = await import(moduleUrl(source))
    let release
    globalThis.fetch = () => new Promise(resolve => { release = resolve })
    await act(async () => { renderer = TestRenderer.create(React.createElement(ChannelFeed, { slug: 'valorant', channels: [] })); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /Loading channel/)
    await act(async () => { renderer.unmount() })
    release({ ok: false })
    let mode = 'posts'
    globalThis.fetch = async url => url.includes('/posts?')
      ? { ok: true, json: async () => ({ posts: mode === 'empty' ? [] : [{ id: 'abc', title: 'Hello', game: 'Valorant', content: 'Text' }], total: mode === 'empty' ? 0 : 1 }) }
      : mode === 'error' ? { ok: false, status: 404 } : { ok: true, json: async () => ({ name: 'Valorant' }) }
    for (const current of ['posts', 'error']) {
      mode = current
      await act(async () => { renderer = TestRenderer.create(React.createElement(ChannelFeed, { slug: 'valorant', channels: [] })); await tick() })
      const html = JSON.stringify(renderer.toJSON())
      if (current === 'posts') {
        assert.match(html, /Valorant/)
        assert.match(html, /For You/)
        const sticky = renderer.root.findByProps({ className: 'forum-sticky-header' })
        assert.equal(sticky.findAllByType('header').length, 1)
        assert.equal(sticky.findAllByProps({ className: 'forum-feed-tabs' }).length, 1)
        assert.equal(sticky.findAllByProps({ className: 'forum-table-header' }).length, 1)
        const toolbar = renderer.root.findByType('header')
        const controlOrder = toolbar.findAll(node => node.type === 'input' || node.type === 'button').map(node => node.type === 'input' ? 'search' : node.children.join(''))
        assert.deepEqual(controlOrder, ['Newest', 'search', '+ Create Post'])
        const feedUrl = () => renderer.root.findAllByType('div').find(item => item.props['data-url']).props['data-url']
        assert.match(feedUrl(), /sort=new/)
        await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'hello' } }))
        assert.match(renderer.root.findByType('input').props.value, /hello/)
        assert.match(feedUrl(), /search=hello/)
        await act(async () => renderer.root.findByProps({ className: 'forum-sort-toggle' }).props.onClick())
        assert.match(feedUrl(), /sort=followed/)
        await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Following')).props.onClick())
        assert.match(JSON.stringify(renderer.toJSON()), /Sign in/)
        await act(async () => renderer.update(React.createElement(ChannelFeed, { slug: 'valorant', channels: [], token: 'alice' })))
        assert.match(feedUrl(), /valorant\/following\/posts/)
      }
      if (current === 'error') assert.match(html, /Channel not found/)
      await act(async () => { renderer.unmount() })
    }
  } finally {
    globalThis.fetch = originalFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct
    await server.close()
  }
})
