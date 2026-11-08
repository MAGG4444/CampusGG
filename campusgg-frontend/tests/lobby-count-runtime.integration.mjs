// Run with: node --env-file-if-exists=../campusgg-backend/.env tests/lobby-count-runtime.integration.mjs
// Read-only check against the running backend and its configured PostgreSQL database.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { currentLobbyFromFeed } from '../src/utils/currentLobby.js'
import { formatLobbyCapacity } from '../src/utils/lobbyFeedSync.js'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const requireBackend = createRequire(new URL('../../campusgg-backend/package.json', import.meta.url))
const { Client } = requireBackend('pg')
const db = new Client({ connectionString: process.env.DATABASE_URL })
const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
try {
  await db.connect()
  const response = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3000'}/lobbies/db`)
  assert.equal(response.status, 200)
  const lobbies = await response.json()
  assert.ok(lobbies.length, 'At least one public lobby is required for this runtime check')
  const { rows } = await db.query('SELECT lobby_id, COUNT(*)::int AS count FROM lobby_members WHERE lobby_id = ANY($1::uuid[]) GROUP BY lobby_id', [lobbies.map(lobby => lobby.id)])
  const counts = new Map(rows.map(row => [row.lobby_id, row.count]))
  async function load(path) {
    const result = await server.transformRequest(path)
    const source = result.code
      .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/node_modules/lucide-react/dist/esm/lucide-react.mjs"', JSON.stringify(import.meta.resolve('lucide-react')))
      .replace('"/src/utils/lobbyFeedSync.js"', JSON.stringify(new URL('../src/utils/lobbyFeedSync.js', import.meta.url).href))
    return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default
  }
  const Card = await load('/src/components/LobbyCard.jsx')
  for (const lobby of lobbies) {
    assert.equal(typeof lobby.memberCount, 'number')
    assert.equal(lobby.memberCount, counts.get(lobby.id) ?? 0)
    const expected = `${lobby.memberCount} / ${lobby.participantLimit === null ? '∞' : lobby.participantLimit} players`
    const card = renderToStaticMarkup(React.createElement(Card, { ...lobby, userName: lobby.host?.username }))
    const current = currentLobbyFromFeed([String(lobby.id)], () => 'host', lobbies)
    assert.ok(card.includes(expected), `Card did not render ${expected}`)
    assert.equal(formatLobbyCapacity(current), expected)
  }
  console.log(`Live API, PostgreSQL and frontend rendering agree for ${lobbies.length} public lobbies.`)
} finally {
  await db.end()
  await server.close()
}
