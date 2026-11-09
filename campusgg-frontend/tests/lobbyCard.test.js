import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('lobby cards use membership styling and keep the game beside the title', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  try {
    const result = await server.transformRequest('/src/components/LobbyCard.jsx')
    const source = result.code
      .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/node_modules/lucide-react/dist/esm/lucide-react.mjs"', JSON.stringify(import.meta.resolve('lucide-react')))
      .replace('"/src/utils/lobbyFeedSync.js"', JSON.stringify(new URL('../src/utils/lobbyFeedSync.js', import.meta.url).href))
    const { default: LobbyCard } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    const render = (role) => renderToStaticMarkup(React.createElement(LobbyCard, { lobbyName: 'Lobby', userName: 'Host', details: '', isJoined: Boolean(role) }))
    assert.doesNotMatch(render('host'), /joined-indicator/)
    assert.doesNotMatch(render('member'), /joined-indicator/)
    assert.match(render('host'), /lobby-card-title[^>]*>Lobby<\/h2><span class="lobby-game-badge">Unspecified<\/span>/)
    assert.match(render('host'), /class="lobby-card lobby-card-joined"/)
    assert.match(render('host'), /Host · Any skill/)
    assert.doesNotMatch(render('host'), /Hosted by/)
    assert.match(render('member'), /class="lobby-card lobby-card-joined"/)
    assert.match(render(null), /class="lobby-card"/)
    assert.doesNotMatch(render(null), /lobby-card-joined/)
    assert.match(render('member'), /Open Lobby/)
    assert.doesNotMatch(render(null), /joined-indicator/)
    const full = renderToStaticMarkup(React.createElement(LobbyCard, { lobbyName: 'Full', userName: 'Host', visibility: 'public', memberCount: 5, participantLimit: 5 }))
    assert.match(full, /5 \/ 5 players/)
    assert.match(full, />Full<\/button>/)
    assert.match(full, /disabled/)
    const unlimited = renderToStaticMarkup(React.createElement(LobbyCard, { lobbyName: 'Open', userName: 'Host', visibility: 'public', memberCount: 12, participantLimit: null }))
    assert.match(unlimited, /12 \/ ∞ players/)
    assert.match(unlimited, /Join Lobby/)
    const joining = renderToStaticMarkup(React.createElement(LobbyCard, { lobbyName: 'Joining', userName: 'Host', visibility: 'public', isJoining: true }))
    assert.match(joining, /Joining\.\.\./)
    assert.match(joining, /disabled/)
    const joinedFull = renderToStaticMarkup(React.createElement(LobbyCard, { lobbyName: 'Joined', userName: 'Host', visibility: 'public', isJoined: true, isJoining: true, memberCount: 5, participantLimit: 5 }))
    assert.match(joinedFull, /Open Lobby/)
    assert.doesNotMatch(joinedFull, /disabled/)
    assert.match(render(null), /\? \/ \? players/)
    const zero = renderToStaticMarkup(React.createElement(LobbyCard, { lobbyName: 'Empty', userName: 'Host', memberCount: 0, participantLimit: 5 }))
    assert.match(zero, /0 \/ 5 players/)
  } finally {
    await server.close()
  }
})
