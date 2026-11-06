import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act, useContext } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { AuthContext } from '../src/context/authContext.js'
import { JoinedLobbiesContext } from '../src/context/joinedLobbiesContext.js'

test('server membership roles drive host, joined, transfer and stale-response handling', async () => {
  const previousFetch = globalThis.fetch
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let memberships = [{ lobbyId: 'lobby', role: 'host' }]
  let resolveOld
  let holdNext = false
  let failMembership = false
  let membersStatus = 200
  globalThis.fetch = async (url) => {
    if (url.endsWith('/memberships/me')) {
      if (failMembership) throw new Error('offline')
      if (holdNext) {
        holdNext = false
        return new Promise(resolve => { resolveOld = resolve })
      }
      return { ok: true, json: async () => memberships }
    }
    if (url.endsWith('/members')) {
      return { ok: membersStatus === 200, status: membersStatus, json: async () => [] }
    }
    return { ok: true, json: async () => ({}) }
  }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  let value
  function Consumer() { value = useContext(JoinedLobbiesContext); return null }
  try {
    const transformed = await server.transformRequest('/src/context/JoinedLobbiesContext.jsx')
    const source = transformed.code
      .replace(/"\/node_modules\/\.vite\/deps\/react\.js\?[^"]+"/g, JSON.stringify(import.meta.resolve('react')))
      .replace(/"\/node_modules\/\.vite\/deps\/react_jsx-dev-runtime\.js\?[^"]+"/g, JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/node_modules/react/index.js"', JSON.stringify(import.meta.resolve('react')))
      .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/src/context/useAuth.js"', JSON.stringify(new URL('../src/context/useAuth.js', import.meta.url).href))
      .replace('"/src/context/joinedLobbiesContext.js"', JSON.stringify(new URL('../src/context/joinedLobbiesContext.js', import.meta.url).href))
    const { JoinedLobbiesProvider } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(AuthContext.Provider, { value: { user: { id: 'user' }, token: 'token' } },
        React.createElement(JoinedLobbiesProvider, null, React.createElement(Consumer))))
    })
    await act(async () => { await value.refreshMemberships() })
    assert.equal(value.getLobbyRole('lobby'), 'host')
    assert.equal(value.isLobbyJoined('lobby'), true)
    failMembership = true
    await act(async () => { await assert.rejects(value.refreshMemberships(), /offline/) })
    assert.equal(value.getLobbyRole('lobby'), 'host')
    failMembership = false
    memberships = [{ lobbyId: 'lobby', role: 'member' }]
    await act(async () => { await value.refreshMemberships() })
    assert.equal(value.getLobbyRole('lobby'), 'member')
    memberships = [{ lobbyId: 'lobby', role: 'host' }]
    await act(async () => { await value.refreshMemberships() })
    assert.equal(value.getLobbyRole('lobby'), 'host')

    membersStatus = 503
    await act(async () => { await assert.rejects(value.refreshLobbyMembers('lobby')) })
    assert.equal(value.getLobbyRole('lobby'), 'host')
    membersStatus = 404
    await act(async () => { await assert.rejects(value.refreshLobbyMembers('lobby')) })
    assert.equal(value.isLobbyJoined('lobby'), false)
    membersStatus = 200
    await act(async () => { await value.refreshMemberships() })
    assert.equal(value.getLobbyRole('lobby'), 'host')

    holdNext = true
    const oldRequest = value.refreshMemberships()
    await act(async () => { await value.leaveLobby('lobby') })
    await act(async () => {
      resolveOld({ ok: true, json: async () => [{ lobbyId: 'lobby', role: 'host' }] })
      await oldRequest
    })
    assert.equal(value.isLobbyJoined('lobby'), false)
    await act(async () => { await value.joinLobby('lobby') })
    assert.equal(value.getLobbyRole('lobby'), 'member')
    memberships = []
    await act(async () => { await value.refreshMemberships() })
    assert.equal(value.getLobbyRole('lobby'), null)

    memberships = [{ lobbyId: 'lobby', role: 'host' }]
    await act(async () => { await value.refreshMemberships() })
    holdNext = true
    const previousAccountRequest = value.refreshMemberships()
    const switchUser = (user, token) => renderer.update(React.createElement(AuthContext.Provider, { value: { user, token } },
      React.createElement(JoinedLobbiesProvider, null, React.createElement(Consumer))))
    await act(async () => { switchUser(null, null) })
    assert.equal(value.isLobbyJoined('lobby'), false)
    await act(async () => { switchUser({ id: 'another' }, 'another-token') })
    assert.equal(value.isLobbyJoined('lobby'), false)
    await act(async () => {
      resolveOld({ ok: true, json: async () => [{ lobbyId: 'lobby', role: 'host' }] })
      await previousAccountRequest
    })
    assert.equal(value.isLobbyJoined('lobby'), false)
    await act(async () => { switchUser({ id: 'user' }, 'new-token') })
    assert.equal(value.isLobbyJoined('lobby'), false)
    await act(async () => { await value.refreshMemberships() })
    assert.equal(value.getLobbyRole('lobby'), 'host')
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.fetch = previousFetch
    await server.close()
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct
  }
})
