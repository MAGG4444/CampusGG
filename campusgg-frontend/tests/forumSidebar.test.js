import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('sidebar shows Home first and every channel in alphabetical order', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ForumSidebar.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', url(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const Link = p => React.createElement('a', { href: p.to, className: p.className }, p.children)`))
    replace('/src/components/ChannelLogo.jsx', url('export default function Logo(){return null}'))
    const { default: Sidebar } = await import(url(source))
    const channels = ['Gamma', 'Alpha', 'Beta'].map(name => ({ id: name, name, slug: name.toLowerCase() }))
    const follows = { token: 'user', loading: false, error: '', channels: [channels[0]] }
    const render = (list, followed = follows) => React.createElement(Sidebar, { channels: list, follows: followed })
    await act(async () => { renderer = TestRenderer.create(render(channels)) })
    const html = JSON.stringify(renderer.toJSON())
    assert.match(html, /Game Channels/)
    assert.doesNotMatch(html, /My Channels|Show .*more|Show Less/)
    assert.equal(renderer.root.findAllByType('a')[0].props.href, '/forum')
    const catalog = renderer.root.findByProps({ id: 'forum-game-channels' })
    assert.deepEqual(catalog.findAllByType('a').map(link => link.props.href), ['/forum/channel/alpha', '/forum/channel/beta', '/forum/channel/gamma'])
    await act(async () => renderer.update(React.createElement(Sidebar, { channels, slug: 'beta' })))
    assert.match(renderer.root.findByProps({ href: '/forum/channel/beta' }).props.className, /is-active/)
    for (const n of [0, 1, 2]) {
      await act(async () => renderer.update(render(channels.slice(0, n))))
      assert.equal(renderer.root.findAllByType('button').length, 0)
    }
    await act(async () => renderer.unmount())
  } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = old; await server.close() }
})
