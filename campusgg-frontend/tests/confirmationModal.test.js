import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('confirmation dialog focuses, traps focus, restores it and blocks Escape while busy', async () => {
  const old = { act: globalThis.IS_REACT_ACT_ENVIRONMENT, document: globalThis.document }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let restored = 0, focused = 0, cancelled = 0
  const trigger = { isConnected: true, focus: () => { restored++ } }
  const cancel = { focus: () => { focused++ } }
  const confirm = { focus: () => { focused++ } }
  globalThis.document = { body: {}, activeElement: cancel }
  const dialog = { open: true, showModal() {}, close() {}, querySelectorAll: () => [cancel, confirm] }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ConfirmationModal.jsx')).code
    source = source.replace(JSON.stringify('/node_modules/react/index.js'), JSON.stringify(import.meta.resolve('react')))
      .replace(JSON.stringify('/node_modules/react/jsx-dev-runtime.js'), JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
      .replace(JSON.stringify('/node_modules/lucide-react/dist/esm/lucide-react.mjs'), JSON.stringify(import.meta.resolve('lucide-react')))
      .replace(JSON.stringify('/node_modules/react-dom/index.js'), JSON.stringify(moduleUrl('export const createPortal = child => child')))
      .replace(/import ".*?\.css";/g, '')
    const { default: Modal } = await import(moduleUrl(source))
    const props = { title: 'Delete this reply?', message: 'Children must be deleted first.', confirmLabel: 'Delete Reply', destructive: true, onCancel: () => { cancelled++ }, onConfirm() {}, returnFocus: trigger }
    await act(async () => { renderer = TestRenderer.create(React.createElement(Modal, props), { createNodeMock: element => element.type === 'dialog' ? dialog : cancel }) })
    assert.equal(focused, 1)
    const node = renderer.root.findByType('dialog')
    assert.ok(node.props['aria-labelledby'])
    assert.ok(node.props['aria-describedby'])
    let prevented = false
    node.props.onKeyDown({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true } })
    assert.equal(prevented, true)
    await act(async () => renderer.update(React.createElement(Modal, { ...props, busy: true })))
    renderer.root.findByType('dialog').props.onCancel({ preventDefault() {} })
    assert.equal(cancelled, 0)
    await act(async () => renderer.update(React.createElement(Modal, props)))
    renderer.root.findByType('dialog').props.onCancel({ preventDefault() {} })
    assert.equal(cancelled, 1)
    await act(async () => renderer.unmount())
    renderer = null
    assert.equal(restored, 1)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = old.act
    globalThis.document = old.document
    await server.close()
  }
})
