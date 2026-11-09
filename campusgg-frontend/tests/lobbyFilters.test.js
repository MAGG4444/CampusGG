import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

test('sidebar collapse and active filter removal remain accessible', async () => {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  const renderers = []
  try {
    const result = await server.transformRequest('/src/components/LobbyFilters.jsx')
    const source = result.code
      .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace('"/src/utils/profile.js"', JSON.stringify(new URL('../src/utils/profile.js', import.meta.url).href))
      .replace('"/src/utils/supportedGames.js"', JSON.stringify(new URL('../src/utils/supportedGames.js', import.meta.url).href))
    const { default: Filters, ActiveLobbyFilters } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    const changed = []
    let sidebar
    await act(async () => { sidebar = TestRenderer.create(React.createElement(Filters, { open: false, game: 'CS2', skill: 'Advanced', capacity: '5', visibility: 'all', onChange: (...args) => changed.push(args) })); renderers.push(sidebar) })
    assert.equal(sidebar.root.findByType('aside').props['aria-hidden'], true)
    assert.equal(sidebar.root.findByType('aside').props.tabIndex, -1)
    await act(async () => { sidebar.update(React.createElement(Filters, { open: true, game: 'CS2', skill: 'Advanced', capacity: '5', visibility: 'all', onChange: (...args) => changed.push(args) })) })
    assert.equal(sidebar.root.findByType('aside').props['aria-hidden'], false)
    assert.equal(sidebar.root.findByType('aside').props.tabIndex, 0)
    assert.deepEqual(sidebar.root.findAllByType('legend').map(item => item.children.join('')), ['Game', 'Skill Level', 'Lobby Capacity', 'Visibility'])
    assert.deepEqual(sidebar.root.findAllByType('fieldset')[0].findAllByType('button').map(item => item.children.join('')), ['All Games', 'CS2', 'Valorant', 'Overwatch 2'])
    const details = sidebar.root.findAllByType('details')
    assert.equal(details.length, 2)
    assert.ok(details.every(item => !item.props.open))
    assert.deepEqual(details.map(item => item.findByType('summary').children.join('')), ['More games', 'More Filters'])
    await act(async () => { sidebar.update(React.createElement(Filters, { open: true, game: 'Apex', skill: 'Advanced', capacity: '5', visibility: 'all', onChange: (...args) => changed.push(args) })) })
    assert.equal(sidebar.root.findAllByType('details')[0].props.open, true)
    assert.equal(sidebar.root.findAllByType('details')[1].props.open, undefined)
    let cleared = 0
    let active
    await act(async () => { active = TestRenderer.create(React.createElement(ActiveLobbyFilters, { game: 'CS2', skill: 'Advanced', capacity: '5', visibility: 'all', onChange: (...args) => changed.push(args), onClear: () => { cleared += 1 } })); renderers.push(active) })
    active.root.findByProps({ 'aria-label': 'Remove Capacity: 5 filter' }).props.onClick()
    active.root.findByProps({ className: 'lobby-clear-filters' }).props.onClick()
    assert.deepEqual(changed, [['capacity', 'any']])
    assert.equal(cleared, 1)
  } finally {
    for (const renderer of renderers) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous
    await server.close()
  }
})
