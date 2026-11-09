import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('deleted lobby clears membership and returns to feed; network failure preserves it', async () => {
  const previous = { fetch: globalThis.fetch, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const forgotten = []
  const navigated = []
  globalThis.__detailTest = { forgotten, navigated }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  const renderers = []
  try {
    const result = await server.transformRequest('/src/pages/LobbyDetail.jsx')
    let source = result.code
    const replace = (path, module) => { source = source.replace(JSON.stringify(path), JSON.stringify(module)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl("export const useNavigate = () => globalThis.__detailTest.navigated.push.bind(globalThis.__detailTest.navigated); export const useLocation = () => ({ state: null }); export const useParams = () => ({ lobbyId: 'deleted-id' });"))
    replace('/src/context/useAuth.js', moduleUrl("export const useAuth = () => ({ user: { id: 'user' }, token: 'token' });"))
    replace('/src/context/useJoinedLobbies.js', moduleUrl("const forgotten = globalThis.__detailTest.forgotten; const forgetLobby = id => forgotten.push(id); const refreshLobbyMembers = async () => []; const refreshMemberships = async () => ({}); export const useJoinedLobbies = () => ({ forgetLobby, refreshLobbyMembers, refreshMemberships });"))
    replace('/src/utils/myContentNavigation.js', moduleUrl("export const myContentReturnTo = () => '/my-content?tab=lobbies';"))
    replace('/src/utils/currentLobby.js', moduleUrl('export const attemptLobbyJoin = async () => ({});'))
    replace('/src/components/notifications/useNotifications.js', moduleUrl('const addNotification = () => {}; export const useNotifications = () => ({ addNotification });'))
    for (const path of ['/src/components/LobbyChat.jsx', '/src/components/ConfirmationModal.jsx', '/src/components/CurrentLobbyDialog.jsx']) replace(path, moduleUrl('export default function Stub() { return null }'))
    source = source.replace('import "/src/pages/LobbyDetail.css";', '')
    const { default: LobbyDetail } = await import(moduleUrl(source))
    globalThis.fetch = async () => ({ ok: false, status: 404 })
    let deleted
    await act(async () => { deleted = TestRenderer.create(React.createElement(LobbyDetail)); renderers.push(deleted); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.deepEqual(forgotten, ['deleted-id'])
    assert.match(JSON.stringify(deleted.toJSON()), /This lobby no longer exists/)
    await act(async () => deleted.root.findByType('button').props.onClick())
    assert.deepEqual(navigated, ['/lobby'])
    await act(async () => deleted.unmount())
    renderers.pop()
    globalThis.fetch = async () => { throw new Error('offline') }
    let offline
    await act(async () => { offline = TestRenderer.create(React.createElement(LobbyDetail)); renderers.push(offline); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.deepEqual(forgotten, ['deleted-id'])
    assert.match(JSON.stringify(offline.toJSON()), /offline/)
  } finally {
    for (const renderer of renderers) await act(async () => renderer.unmount())
    globalThis.fetch = previous.fetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act
    delete globalThis.__detailTest
    await server.close()
  }
})
