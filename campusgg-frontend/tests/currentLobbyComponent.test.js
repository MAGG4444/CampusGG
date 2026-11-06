import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

test('current lobby section and conflict dialog open the correct lobby', async () => {
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  const renderers = []
  try {
    async function load(path, replace = source => source) {
      const result = await server.transformRequest(path)
      const source = replace(result.code)
        .replace('"/node_modules/react/jsx-dev-runtime.js"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    }
    const { default: Section } = await load('/src/components/CurrentLobbySection.jsx')
    const stub = `data:text/javascript;base64,${Buffer.from('export default function Modal(props) { globalThis.__currentLobbyModal = props; return null }').toString('base64')}`
    const { default: Dialog } = await load('/src/components/CurrentLobbyDialog.jsx', source =>
      source.replace('"/src/components/ConfirmationModal.jsx"', JSON.stringify(stub)))
    const lobby = { id: 'lobby-id', lobbyName: 'Squad', game: 'Valorant', role: 'host' }
    const opened = []
    let section
    await act(async () => { section = TestRenderer.create(React.createElement(Section, { lobby, onOpen: id => opened.push(id) })); renderers.push(section) })
    const text = JSON.stringify(section.toJSON())
    assert.match(text, /Your Current Lobby/)
    assert.match(text, /Squad/)
    assert.match(text, /Host/)
    await act(async () => { section.root.findByType('button').props.onClick() })
    assert.deepEqual(opened, ['lobby-id'])
    await act(async () => { renderers.push(TestRenderer.create(React.createElement(Dialog, { lobby, onCancel() {}, onView: id => opened.push(id) }))) })
    assert.match(globalThis.__currentLobbyModal.message, /only one active lobby.*Squad/)
    assert.equal(globalThis.__currentLobbyModal.confirmLabel, 'View Current Lobby')
    globalThis.__currentLobbyModal.onConfirm()
    assert.deepEqual(opened, ['lobby-id', 'lobby-id'])
  } finally {
    for (const renderer of renderers) await act(async () => renderer.unmount())
    delete globalThis.__currentLobbyModal
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct
    await server.close()
  }
})
