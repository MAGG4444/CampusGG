import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('sort menu exposes two choices, selection and Escape', async () => {
  const old = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer, selected
  try {
    let source = (await server.transformRequest('/src/components/ForumSort.jsx')).code
    source = source.replace('"/node_modules/react/index.js"', JSON.stringify(import.meta.resolve('react'))).replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
    const { default: Sort } = await import(url(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(Sort, { value: 'new', onChange: value => { selected = value } })) })
    const region = () => renderer.root.findByProps({ className: 'forum-sort-menu' })
    const trigger = () => renderer.root.findByProps({ className: 'lobby-filters-toggle forum-sort-toggle' })
    await act(async () => trigger().props.onClick())
    assert.equal(trigger().props['aria-expanded'], true)
    assert.deepEqual(renderer.root.findAllByType('button').slice(1).map(button => button.children[0]), ['Newest', 'Most Followed'])
    assert.equal(renderer.root.findAllByType('button')[1].props['aria-pressed'], true)
    await act(async () => renderer.root.findAllByType('button')[2].props.onClick())
    assert.equal(selected, 'followed')
    await act(async () => renderer.update(React.createElement(Sort, { value: selected, onChange: value => { selected = value } })))
    assert.equal(trigger().children[0], 'Most Followed')
    await act(async () => region().props.onMouseEnter())
    let focused = false
    await act(async () => region().props.onKeyDown({ key: 'Escape', currentTarget: { querySelector: () => ({ focus: () => { focused = true } }) } }))
    assert.equal(trigger().props['aria-expanded'], false)
    assert.equal(focused, true)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = old
    await server.close()
  }
})

test('table and sort styles share stable columns and container-aware sizing', async () => {
  const css = await readFile(new URL('../src/pages/Forum.css', import.meta.url), 'utf8')
  assert.match(css, /\.forum-table-header, \.forum-post-card\s*\{[^}]*grid-template-columns:\s*var\(--discussion-columns\)/)
  assert.match(css, /@container \(max-width: 650px\)/)
  assert.match(css, /\.forum-sort-menu\s*\{[^}]*--forum-sort-width:\s*152px/)
  assert.match(css, /\.forum-sort-options\s*\{[^}]*width:\s*100%/)
  assert.match(css, /\.forum-sort-toggle, \.forum-sort-options button\s*\{[^}]*white-space:\s*nowrap/)
})
