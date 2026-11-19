import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('report dialog validates, retains failed input and submits details', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  const oldDocument = globalThis.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.document = { body:{} }
  const server = await createServer({ optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true,hmr:false,watch:null}, appType:'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ReportDialog.jsx')).code
    source = source.replaceAll(JSON.stringify('/node_modules/react/index.js'), JSON.stringify(import.meta.resolve('react')))
    source = source.replaceAll(JSON.stringify('/node_modules/react/jsx-dev-runtime.js'), JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
    source = source.replace(JSON.stringify('/node_modules/react-dom/index.js'), JSON.stringify(moduleUrl('export const createPortal = child => child')))
    source = source.replace(/import ".*?\.css";/g, '')
    const { default: ReportDialog } = await import(moduleUrl(source))
    let sent, closed = 0, fail = true, calls = 0, pending
    const target = { commentId:'comment' }
    await act(async () => { renderer = TestRenderer.create(React.createElement(ReportDialog, { target, onCancel:()=>closed++, onSubmit:async payload=>{calls++; sent=payload; if (fail) throw new Error('Offline'); if (pending) await pending} }), { createNodeMock: element => element.type === 'dialog' ? { showModal(){}, close(){}, open:true } : { focus(){} } }) })
    const submit = () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})
    await act(submit)
    assert.match(renderer.root.findByProps({role:'alert'}).children[0], /Choose a reason/)
    await act(async () => renderer.root.findByType('select').props.onChange({target:{value:'other'}}))
    await act(submit)
    assert.match(renderer.root.findByProps({role:'alert'}).children[0], /explain Other/)
    await act(async () => renderer.root.findAllByType('textarea')[0].props.onChange({target:{value:'Custom reason'}}))
    await act(async () => renderer.root.findAllByType('textarea')[1].props.onChange({target:{value:'More detail'}}))
    await act(submit)
    assert.deepEqual(sent, {reason:'other',customReason:'Custom reason',details:'More detail'})
    assert.equal(renderer.root.findAllByType('textarea')[0].props.value, 'Custom reason')
    assert.equal(renderer.root.findByProps({role:'alert'}).children[0], 'Offline')
    assert.equal(closed, 0)
    fail = false
    let resolve
    pending = new Promise(done => { resolve = done })
    await act(async () => { void submit(); void submit() })
    assert.equal(calls, 2)
    await act(async () => { resolve(); await pending })
    assert.equal(closed, 1)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    globalThis.document = oldDocument
    await server.close()
  }
})
