import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('game selector uses supplied channel names and preserves saved legacy values', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  try {
    let source = (await server.transformRequest('/src/components/GameSelect.jsx')).code
    source = source.replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/src/utils/profile.js"', JSON.stringify(new URL('../src/utils/profile.js', import.meta.url).href))
      .replace('import "/src/components/GameSelect.css";', '')
    const { default: GameSelect } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    const markup = renderToStaticMarkup(React.createElement(GameSelect, { id: 'game', value: 'Overwatch 2', onChange() {}, games: ['CS2', 'Minecraft', 'OW2'] }))
    assert.match(markup, /value="CS2"/)
    assert.match(markup, /value="Minecraft"/)
    assert.match(markup, /value="OW2"/)
    assert.match(markup, /value="Overwatch 2" selected="">Overwatch 2 \(saved\)/)
  } finally { await server.close() }
})
