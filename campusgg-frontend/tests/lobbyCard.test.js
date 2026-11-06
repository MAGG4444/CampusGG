import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('lobby cards show the authoritative host or member label', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  try {
    const result = await server.transformRequest('/src/components/LobbyCard.jsx')
    const source = result.code
      .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/node_modules/lucide-react/dist/esm/lucide-react.mjs"', JSON.stringify(import.meta.resolve('lucide-react')))
    const { default: LobbyCard } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    const render = (role) => renderToStaticMarkup(React.createElement(LobbyCard, { lobbyName: 'Lobby', userName: 'Host', details: '', isJoined: Boolean(role), role }))
    assert.match(render('host'), /<span>Host<\/span>/)
    assert.match(render('member'), /<span>Joined<\/span>/)
    assert.doesNotMatch(render(null), /joined-indicator/)
  } finally {
    await server.close()
  }
})
