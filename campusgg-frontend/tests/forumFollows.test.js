import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act, useContext } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { ForumFollowsContext } from '../src/context/forumFollowsContext.js'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('follow state shares server results and resets across accounts', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let release
  globalThis.__followRequest = async (path, options) => {
    if (path === '/forum/me/channels') return options.token === 'alice' ? [{ id: 'cs', slug: 'cs2', name: 'CS2' }] : []
    if (options.method === 'DELETE') return { following: false }
    return new Promise(resolve => { release = resolve })
  }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  let current
  try {
    let source = (await server.transformRequest('/src/context/ForumFollowsProvider.jsx')).code
    source = source.replace('"/node_modules/react/index.js"', JSON.stringify(import.meta.resolve('react')))
      .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/src/api/request.js"', JSON.stringify(moduleUrl('export const request=(...args)=>globalThis.__followRequest(...args)')))
      .replace('"/src/context/forumFollowsContext.js"', JSON.stringify(new URL('../src/context/forumFollowsContext.js', import.meta.url).href))
    const { default: Provider } = await import(moduleUrl(source))
    function Probe() { current = useContext(ForumFollowsContext); return React.createElement('span', null, current.channels.map(item => item.name).join(',')) }
    const render = (token) => React.createElement(Provider, { token, key: token }, React.createElement(Probe))
    await act(async () => { renderer = TestRenderer.create(render('alice')); await tick() })
    assert.equal(current.channels[0].name, 'CS2')
    await act(async () => { await current.toggle(current.channels[0], true) })
    assert.equal(current.channels.length, 0)
    await act(async () => { current.toggle({ id: 'v', slug: 'valorant', name: 'Valorant' }, false); await tick() })
    assert.equal(current.busy.v, true)
    await act(async () => { renderer.update(render('bob')); await tick() })
    assert.equal(current.channels.length, 0)
    await act(async () => { release({ following: true }); await tick() })
    assert.equal(current.channels.length, 0)
    await act(async () => renderer.unmount())
  } finally {
    delete globalThis.__followRequest
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    await server.close()
  }
})
