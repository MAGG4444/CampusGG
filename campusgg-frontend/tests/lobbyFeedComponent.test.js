import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

test('sticky toolbar, incremental rendering, filtering and background refresh', async () => {
  const previous = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document, observer: globalThis.IntersectionObserver, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.__feedTest = {}
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    const result = await server.transformRequest('/src/components/LobbyFeed.jsx')
    let source = result.code
    const replace = (path, value) => { source = source.replace(JSON.stringify(path), JSON.stringify(value)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl('const navigate = path => { globalThis.__feedTest.navigated = path }; export const useNavigate = () => navigate;'))
    replace('/src/context/useAuth.js', moduleUrl('export const useAuth = () => ({ isAuthenticated: !!globalThis.__feedTest.auth, token: null });'))
    replace('/src/context/useJoinedLobbies.js', moduleUrl("const isLobbyJoined = id => !!globalThis.__feedTest.roles?.[id]; const getLobbyRole = id => globalThis.__feedTest.roles?.[id] || null; const joinLobby = (...args) => globalThis.__feedTest.join(...args); const refreshMemberships = async () => globalThis.__feedTest.roles || {}; export const useJoinedLobbies = () => ({ joinedLobbyIds: Object.keys(globalThis.__feedTest.roles || {}), isLobbyJoined, getLobbyRole, joinLobby, refreshMemberships });"))
    replace('/src/utils/lobbyFeedSync.js', new URL('../src/utils/lobbyFeedSync.js', import.meta.url).href)
    replace('/src/utils/currentLobby.js', new URL('../src/utils/currentLobby.js', import.meta.url).href)
    replace('/src/components/LobbyFilters.jsx', moduleUrl('export default function Filters(props) { globalThis.__feedTest.filters = props; return null } export function ActiveLobbyFilters(props) { globalThis.__feedTest.active = props; return null }'))
    const reactUrl = import.meta.resolve('react')
    replace('/src/components/LobbyCard.jsx', moduleUrl(`import React from ${JSON.stringify(reactUrl)}; export default function Card(props) { return React.createElement('article', { ref: props.cardRef, 'data-name': props.lobbyName, 'data-count': props.memberCount, 'data-joining': props.isJoining, 'data-joined': props.isJoined }, React.createElement('button', { onClick: props.onJoin, disabled: props.isJoining }, 'Join')) }`))
    replace('/src/components/SearchBar.jsx', moduleUrl(`import React from ${JSON.stringify(reactUrl)}; export default function Search(props) { return React.createElement('input', { 'aria-label': 'Search', value: props.value, onChange: e => props.onChange(e.target.value) }) }`))
    replace('/src/components/CurrentLobbyDialog.jsx', moduleUrl('export default function Stub() { return null }'))
    const { default: LobbyFeed } = await import(moduleUrl(source))
    const listeners = new Map()
    const events = { addEventListener(name, fn) { listeners.set(name, fn) }, removeEventListener(name) { listeners.delete(name) } }
    globalThis.document = { ...events, visibilityState: 'visible' }
    globalThis.window = { ...events, setTimeout, clearTimeout }
    const observers = []
    globalThis.IntersectionObserver = class {
      constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this) }
      observe(node) { this.node = node }
      disconnect() {}
    }
    const lobbies = Array.from({ length: 13 }, (_, index) => ({ id: String(index), lobbyName: `Lobby ${index}`, visibility: 'public', game: index < 7 ? 'Valorant' : 'CS2', memberCount: 1 }))
    let mode = 'deferred'
    let resolveFirst
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      if (mode === 'deferred') return new Promise(resolve => { resolveFirst = resolve })
      if (mode === 'error') throw new Error('offline')
      return { ok: true, json: async () => mode === 'empty' ? [] : [...lobbies, lobbies[0]] }
    }
    const nodeMock = element => {
      if (element.props.className === 'lobby-page') return { style: { setProperty() {} } }
      if (element.props.className === 'lobby-toolbar') return { getBoundingClientRect: () => ({ height: 60, bottom: 60 }) }
      if (element.props.className === 'lobby-results-anchor') return { getBoundingClientRect: () => ({ top: 100 }), scrollIntoView() {} }
      return {}
    }
    await act(async () => { renderer = TestRenderer.create(React.createElement(LobbyFeed), { createNodeMock: nodeMock }); await wait(0) })
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Loading lobbies' }).findAllByProps({ className: 'lobby-skeleton' }).length, 4)
    mode = 'data'
    await act(async () => { resolveFirst({ ok: true, json: async () => [...lobbies, lobbies[0]] }); await wait(0) })
    const toolbar = renderer.root.findByProps({ className: 'lobby-toolbar' })
    assert.equal(toolbar.findAllByType('button').length, 2)
    assert.equal(toolbar.findAllByType('input').length, 1)
    assert.equal(renderer.root.findAllByType('h1').length, 0)
    assert.equal(renderer.root.findAllByType('article').length, 6)
    assert.equal(observers.at(-1).options.root, null)
    await act(async () => { observers.at(-1).callback([{ isIntersecting: true }]); await wait(150) })
    assert.equal(renderer.root.findAllByType('article').length, 12)
    lobbies[0] = { ...lobbies[0], memberCount: 2 }
    await act(async () => { listeners.get('focus')(); await wait(0) })
    assert.equal(renderer.root.findAllByType('article').length, 12)
    assert.equal(renderer.root.findAllByType('article')[0].props['data-count'], 2)
    await act(async () => { observers.at(-1).callback([{ isIntersecting: true }]); await wait(150) })
    assert.equal(renderer.root.findAllByType('article').length, 13)
    assert.equal(new Set(renderer.root.findAllByType('article').map(item => item.props['data-name'])).size, 13)
    assert.match(JSON.stringify(renderer.toJSON()), /reached the end/)
    lobbies.pop()
    await act(async () => { listeners.get('focus')(); await wait(0) })
    assert.equal(renderer.root.findAllByType('article').length, 12)
    assert.match(JSON.stringify(renderer.toJSON()), /reached the end/)
    await act(async () => { globalThis.__feedTest.filters.onChange('game', 'Valorant') })
    assert.equal(renderer.root.findAllByType('article').length, 6)
    assert.equal(globalThis.__feedTest.active.game, 'Valorant')
    const search = renderer.root.findByProps({ 'aria-label': 'Search' })
    await act(async () => search.props.onChange({ target: { value: 'no matching name' } }))
    assert.match(JSON.stringify(renderer.toJSON()), /No matching lobbies/)
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Clear Filters')).props.onClick())
    assert.equal(search.props.value, '')
    assert.equal(globalThis.__feedTest.filters.game, 'All Games')
    assert.equal(renderer.root.findAllByType('article').length, 6)
    mode = 'error'
    await act(async () => { listeners.get('focus')(); await wait(0) })
    assert.equal(renderer.root.findAllByType('article').length, 6)
    assert.match(JSON.stringify(renderer.toJSON()), /Unable to load lobbies/)
    mode = 'data'
    const priorCalls = calls
    await act(async () => { renderer.root.findAllByType('button').find(button => button.children.includes('Retry')).props.onClick(); await wait(0) })
    assert.ok(calls > priorCalls)
    assert.equal(renderer.root.findAllByType('article').length, 6)
    const toggle = renderer.root.findByProps({ 'aria-controls': 'lobby-filters' })
    await act(async () => toggle.props.onClick())
    assert.equal(globalThis.__feedTest.filters.open, false)
    assert.equal(globalThis.__feedTest.active.game, 'All Games')
    await act(async () => renderer.unmount())
    renderer = null
    mode = 'error'
    await act(async () => { renderer = TestRenderer.create(React.createElement(LobbyFeed), { createNodeMock: nodeMock }); await wait(0) })
    assert.match(JSON.stringify(renderer.toJSON()), /Unable to load lobbies/)
    mode = 'empty'
    await act(async () => { renderer.root.findAllByType('button').find(button => button.children.includes('Retry')).props.onClick(); await wait(0) })
    assert.match(JSON.stringify(renderer.toJSON()), /No lobbies yet/)
    assert.equal(renderer.root.findAllByType('button').some(button => button.children.includes('Clear Filters')), false)
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Create Lobby')).props.onClick())
    assert.equal(globalThis.__feedTest.navigated, '/create-lobby')
    await act(async () => renderer.unmount())
    renderer = null
    mode = 'data'
    globalThis.__feedTest.auth = true
    let rejectJoin
    globalThis.__feedTest.join = () => new Promise((resolve, reject) => { rejectJoin = reject })
    await act(async () => { renderer = TestRenderer.create(React.createElement(LobbyFeed), { createNodeMock: nodeMock }); await wait(0) })
    await act(async () => { renderer.root.findAllByType('article')[0].findByType('button').props.onClick(); await wait(0) })
    assert.equal(renderer.root.findAllByType('article')[0].props['data-joining'], true)
    assert.equal(renderer.root.findAllByType('article')[0].findByType('button').props.disabled, true)
    await act(async () => { rejectJoin(new Error('Network unavailable')); await wait(0) })
    assert.equal(renderer.root.findAllByType('article')[0].props['data-joining'], false)
    assert.match(JSON.stringify(renderer.toJSON()), /Network unavailable/)
    globalThis.__feedTest.join = async id => { globalThis.__feedTest.roles = { [id]: 'member' } }
    await act(async () => { renderer.root.findAllByType('article')[0].findByType('button').props.onClick(); await wait(0) })
    assert.equal(renderer.root.findAllByType('article')[0].props['data-joined'], true)
    assert.equal(globalThis.__feedTest.navigated, '/lobby/0')
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /YOUR CURRENT LOBBY/)
    const visibility = observers.findLast(observer => observer.options.threshold?.includes(0.98))
    await act(async () => visibility.callback([{ target: visibility.node, isIntersecting: true, intersectionRatio: 1 }]))
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Open My Lobby' }).props['aria-hidden'], true)
    await act(async () => visibility.callback([{ target: visibility.node, isIntersecting: false, intersectionRatio: 0 }]))
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Open My Lobby' }).props.onClick())
    assert.equal(globalThis.__feedTest.navigated, '/lobby/0')
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Search' }).props.onChange({ target: { value: 'Lobby 1' } }))
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Open My Lobby' }).props['aria-hidden'], false)
    globalThis.__feedTest.roles = {}
    await act(async () => renderer.update(React.createElement(LobbyFeed)))
    assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Open My Lobby' }).length, 0)
    globalThis.__feedTest.roles = { 8: 'host' }
    await act(async () => { renderer.update(React.createElement(LobbyFeed)); renderer.root.findByProps({ 'aria-label': 'Search' }).props.onChange({ target: { value: '' } }) })
    assert.equal(renderer.root.findAllByType('article')[0].props['data-name'], 'Lobby 8')
    assert.equal(renderer.root.findAllByType('article').filter(article => article.props['data-name'] === 'Lobby 8').length, 1)
    await act(async () => { listeners.get('focus')(); await wait(0) })
    assert.equal(renderer.root.findAllByType('article')[0].props['data-name'], 'Lobby 8')
    for (let index = 12; index < 19; index += 1) lobbies.push({ id: String(index), lobbyName: `Lobby ${index}`, visibility: 'public', game: 'CS2', memberCount: 1 })
    globalThis.__feedTest.roles = { 18: 'member' }
    await act(async () => { listeners.get('focus')(); await wait(0) })
    await act(async () => globalThis.__feedTest.filters.onChange('game', 'CS2'))
    assert.equal(renderer.root.findAllByType('article').some(article => article.props['data-name'] === 'Lobby 18'), false)
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Open My Lobby' }).props['aria-hidden'], false)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.fetch = previous.fetch
    globalThis.window = previous.window
    globalThis.document = previous.document
    globalThis.IntersectionObserver = previous.observer
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act
    delete globalThis.__feedTest
    await server.close()
  }
})
