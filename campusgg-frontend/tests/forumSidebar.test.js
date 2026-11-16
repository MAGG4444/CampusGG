import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('sidebar puts followed channels first and expands only the catalog', async () => {
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
    assert.ok(html.indexOf('My Channels') < html.indexOf('Game Channels'))
    const button = renderer.root.findByType('button')
    assert.equal(button.props['aria-expanded'], false)
    assert.match(button.children.join(''), /Show 1 more/)
    const catalog = renderer.root.findByProps({ id: 'forum-game-channels' })
    assert.deepEqual(catalog.findAllByType('a').map(link => link.props.href), ['/forum/channel/alpha', '/forum/channel/beta'])
    await act(async () => button.props.onClick())
    assert.equal(button.props['aria-expanded'], true)
    assert.equal(catalog.findAllByType('a').length, 3)
    await act(async () => button.props.onClick())
    assert.equal(catalog.findAllByType('a').length, 2)
    for (const n of [0, 1, 2]) {
      await act(async () => renderer.update(render(channels.slice(0, n))))
      assert.equal(renderer.root.findAllByType('button').length, 0)
    }
    await act(async () => renderer.update(render(channels, { ...follows, channels: [] })))
    assert.match(JSON.stringify(renderer.toJSON()), /No followed channels/)
    await act(async () => renderer.unmount())
  } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = old; await server.close() }
})
