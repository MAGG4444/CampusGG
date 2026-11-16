import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('Explore renders catalog, searches names and aliases, filters and retries', async () => {
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ExploreChannels.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/src/components/ChannelLogo.jsx', moduleUrl('export default function Logo(){return null}'))
    replace('/src/utils/channelPresentation.js', new URL('../src/utils/channelPresentation.js', import.meta.url).href)
    replace('/src/components/FollowButton.jsx', moduleUrl('export default function Follow(){ return null }'))
    replace('/src/context/forumFollowsContext.js', moduleUrl('export const useForumFollows = () => null'))
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const Link = p => React.createElement('a', {href:p.to, className:p.className}, p.children)`))
    const { default: Explore } = await import(moduleUrl(source))
    const channels = [
      { id: 'cs', slug: 'counter-strike-2', name: 'CS2', aliases: ['cs2', 'counter-strike 2'], category: 'FPS', followerCount: 2 },
      { id: 'minecraft', slug: 'minecraft', name: 'Minecraft', aliases: ['minecraft'], category: 'Sandbox', followerCount: 0 },
    ]
    let retried = false
    const render = props => React.createElement(Explore, { channels, error: false, onRetry: () => { retried = true }, ...props })
    await act(async () => { renderer = TestRenderer.create(render()) })
    assert.ok(renderer.root.findAllByType('a').length >= 2)
    assert.equal(renderer.root.findAllByType('a')[0].props.href, '/forum/channel/counter-strike-2')
    const input = renderer.root.findByProps({ 'aria-label': 'Search game communities' })
    await act(async () => input.props.onChange({ target: { value: 'MINECRAFT' } }))
    assert.equal(renderer.root.findAllByType('a')[0].props.href, '/forum/channel/minecraft')
    await act(async () => input.props.onChange({ target: { value: 'Counter-Strike 2' } }))
    assert.equal(renderer.root.findAllByType('a')[0].props.href, '/forum/channel/counter-strike-2')
    await act(async () => input.props.onChange({ target: { value: '' } }))
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Sandbox')).props.onClick())
    assert.equal(renderer.root.findAllByType('a')[0].props.href, '/forum/channel/minecraft')
    await act(async () => input.props.onChange({ target: { value: 'missing' } }))
    assert.match(JSON.stringify(renderer.toJSON()), /No communities match/)
    await act(async () => renderer.update(render({ channels: [], error: false })))
    assert.match(JSON.stringify(renderer.toJSON()), /No game channels are available/)
    await act(async () => renderer.update(render({ channels: null, error: false })))
    assert.match(JSON.stringify(renderer.toJSON()), /Loading channels/)
    await act(async () => renderer.update(render({ channels: null, error: true })))
    await act(async () => renderer.root.findByType('button').props.onClick())
    assert.equal(retried, true)
    await act(async () => renderer.unmount())
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct
    await server.close()
  }
})
