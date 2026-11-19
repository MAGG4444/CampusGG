import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

test('threads keep descendants collapsed until expanded and preserve reply targets', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  const oldDocument = globalThis.document
  const oldWindow = globalThis.window
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ReplyItem.jsx')).code
    source = source.replaceAll(JSON.stringify('/node_modules/react/index.js'), JSON.stringify(import.meta.resolve('react')))
    source = source.replace(JSON.stringify('/node_modules/react/jsx-dev-runtime.js'), JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
    source = source.replace(JSON.stringify('/node_modules/lucide-react/dist/esm/lucide-react.mjs'), JSON.stringify(import.meta.resolve('lucide-react')))
    source = source.replace(JSON.stringify('/node_modules/react-dom/index.js'), JSON.stringify(moduleUrl('export const createPortal = element => element')))
    const { default: ReplyItem } = await import(moduleUrl(source))
    const replies = [
      { id:'a', author:'Alice', authorId:'a', content:'Main', createdAt:'2025-01-01T00:00:00Z', likeCount:3 },
      { id:'b', author:'Bob', authorId:'b', content:'First', parentReplyId:'a', createdAt:'2025-01-02T00:00:00Z' },
      { id:'c', author:'Cara', authorId:'c', content:'Second', parentReplyId:'b', createdAt:'2025-01-03T00:00:00Z' },
      { id:'d', author:'Dan', authorId:'d', content:'Third', parentReplyId:'c', createdAt:'2025-01-04T00:00:00Z' },
    ]
    let target, deleteTarget, likeCalls = 0, resolveLike
    const pendingLike = new Promise(resolve => { resolveLike = resolve })
    await act(async () => { renderer = TestRenderer.create(React.createElement(ReplyItem, { reply:replies[0], replies, currentUserId:'a', liked:true, likeReady:true, onLike:async()=>{ likeCalls++; await pendingLike }, onReply:value=>{ target=value }, onEdit:async()=>{}, onDelete:value=>{ deleteTarget=value }, renderComposer:()=>null })) })
    const thread = renderer.root.findByProps({className:'reply-thread'})
    assert.equal(thread.findAllByProps({className:'main-reply'}).length, 1)
    const main = thread.findByProps({className:'main-reply'})
    assert.deepEqual(main.children.filter(child => child && typeof child === 'object').slice(0, 2).map(child => child.props.className), ['reply-meta', 'reply-content'])
    assert.equal(thread.findAllByProps({className:'subreply'}).length, 0)
    assert.equal(thread.findAllByProps({className:'reply-like'}).length, 1)
    const actions = main.findByProps({className:'reply-actions'})
    assert.equal(actions.findAllByType('button').length, 3)
    assert.deepEqual(actions.children.map(child => child.props.className || child.type), ['button', 'reply-menu', 'reply-collapse-button'])
    assert.equal(actions.findByProps({className:'reply-collapse-button'}).findByType('span').children.join(''), 'Show all 3 replies')
    assert.match(actions.findByProps({className:'reply-collapse-button'}).findByType('svg').props.className, /chevron-down/)
    assert.equal(actions.findByProps({className:'reply-collapse-button'}).props['aria-expanded'], false)
    await act(async () => main.findByProps({ 'aria-label': "More actions for Alice's reply" }).props.onClick())
    const ownerMenu = main.findByProps({ 'aria-label': 'Reply actions' })
    assert.deepEqual(ownerMenu.findAllByType('button').map(button => button.children[0]), ['Dislike', 'Report', 'Edit', 'Delete'])
    await act(async () => ownerMenu.findAllByType('button').find(button => button.children.includes('Delete')).props.onClick())
    assert.equal(deleteTarget.id, 'a')
    assert.equal(thread.findByProps({'aria-label':'Unlike reply'}).props['aria-pressed'], true)
    const like = thread.findByProps({'aria-label':'Unlike reply'}).props.onClick
    await act(async () => { void like(); void like() })
    assert.equal(likeCalls, 1)
    await act(async () => { resolveLike(); await pendingLike })
    const childSection = thread.findByProps({className:'reply-children'})
    assert.equal(childSection.props.hidden, true)
    assert.equal(actions.findByProps({className:'reply-collapse-button'}).props['aria-controls'], childSection.props.id)
    await act(async () => renderer.root.findByProps({className:'reply-collapse-button'}).props.onClick())
    assert.equal(thread.findAllByProps({className:'subreply'}).length, 3)
    assert.match(JSON.stringify(renderer.toJSON()), /Cara.*replied to.*Bob/)
    assert.match(JSON.stringify(renderer.toJSON()), /Dan.*replied to.*Cara/)
    const cara = thread.findAllByProps({className:'subreply'})[1]
    await act(async () => cara.findAllByType('button').find(b => b.children.includes(' Reply')).props.onClick())
    assert.equal(target.id, 'c')
    await act(async () => cara.findByProps({ 'aria-label': "More actions for Cara's reply" }).props.onClick())
    const menu = cara.findByProps({ 'aria-label': 'Reply actions' })
    assert.deepEqual(menu.findAllByType('button').map(button => button.children[0]), ['Dislike', 'Report'])
    assert.equal(menu.findAllByType('button')[0].props.disabled, true)
    assert.notEqual(menu.findAllByType('button')[1].props.disabled, true)
    assert.equal(cara.findByType('time').props.dateTime, '2025-01-03T00:00:00Z')
    assert.equal(actions.findByProps({className:'reply-collapse-button'}).props['aria-label'], 'Collapse replies')
    assert.match(actions.findByProps({className:'reply-collapse-button'}).findByType('svg').props.className, /chevron-up/)
    await act(async () => actions.findByProps({className:'reply-collapse-button'}).props.onClick())
    assert.equal(thread.findAllByProps({className:'subreply'}).length, 0)
    await act(async () => renderer.update(React.createElement(ReplyItem, { reply:replies[0], replies, newReplyId:'d', currentUserId:'a', liked:true, likeReady:true, onLike:async()=>{}, onReply:()=>{}, onEdit:async()=>{}, onDelete:async()=>{}, renderComposer:()=>null })))
    assert.equal(thread.findAllByProps({className:'subreply'}).length, 3)
    await act(async () => renderer.update(React.createElement(React.Fragment, null,
      React.createElement(ReplyItem, { key:'a', reply:replies[0], replies, onReply:()=>{}, renderComposer:()=>null }),
      React.createElement(ReplyItem, { key:'empty', reply:{id:'empty',author:'Eve',content:'No replies'}, replies, onReply:()=>{}, renderComposer:()=>null }),
      React.createElement(ReplyItem, { key:'other', reply:{id:'other',author:'Finn',content:'Other'}, replies:[...replies,{id:'child',parentReplyId:'other',author:'Gina',content:'Child'}], onReply:()=>{}, renderComposer:()=>null }))))
    const threads = renderer.root.findAllByProps({className:'reply-thread'})
    assert.equal(threads[1].findAllByProps({className:'reply-collapse-button'}).length, 0)
    assert.equal(threads[2].findByProps({className:'reply-collapse-button'}).findByType('span').children.join(''), 'Show all 1 replies')
    await act(async () => threads[0].findByProps({className:'reply-collapse-button'}).props.onClick())
    assert.equal(threads[0].findAllByProps({className:'subreply'}).length, 3)
    assert.equal(threads[2].findAllByProps({className:'subreply'}).length, 0)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    globalThis.document = oldDocument
    globalThis.window = oldWindow
    await server.close()
  }
})

test('main reply author line is compact while the like button remains at the top right', async () => {
  const css = await readFile(new URL('../src/pages/PostDetail.css', import.meta.url), 'utf8')
  assert.match(css, /\.reply-meta\s*\{[^}]*margin-bottom:\s*6px/)
  assert.match(css, /\.main-reply \.reply-like\s*\{[^}]*position:\s*absolute;[^}]*top:\s*0;[^}]*right:\s*0/)
  assert.match(css, /\.reply-content\s*\{[^}]*margin:\s*0/)
})

test('long threads render progressive batches and restore focus with motion preference', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  const oldWindow = globalThis.window
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let reduced = false
  globalThis.window = { matchMedia: () => ({ matches: reduced }) }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ReplyItem.jsx')).code
    source = source.replaceAll(JSON.stringify('/node_modules/react/index.js'), JSON.stringify(import.meta.resolve('react')))
    source = source.replace(JSON.stringify('/node_modules/react/jsx-dev-runtime.js'), JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
    source = source.replace(JSON.stringify('/node_modules/lucide-react/dist/esm/lucide-react.mjs'), JSON.stringify(import.meta.resolve('lucide-react')))
    source = source.replace(JSON.stringify('/node_modules/react-dom/index.js'), JSON.stringify(moduleUrl('export const createPortal = element => element')))
    const { default: ReplyItem } = await import(moduleUrl(source))
    const root = { id:'root', author:'Root', content:'Root' }
    const children = Array.from({length: 50}, (_, index) => ({ id:`r${String(index).padStart(2, '0')}`, parentReplyId:index ? `r${String(index - 1).padStart(2, '0')}` : 'root', author:`User ${index}`, content:`Reply ${index}`, createdAt:new Date(Date.UTC(2025, 0, index + 1)).toISOString() }))
    const scrolls = [], focuses = []
    const props = { reply:root, replies:[root, ...children.toReversed()], onReply:()=>{}, renderComposer:()=>null }
    await act(async () => { renderer = TestRenderer.create(React.createElement(ReplyItem, props), { createNodeMock: element => element.props.className === 'reply-thread' ? { scrollIntoView: options => scrolls.push(options) } : element.props.className === 'reply-collapse-button' ? { focus: options => focuses.push(options) } : null }) })
    const visible = () => renderer.root.findAllByProps({className:'subreply'})
    const action = () => renderer.root.findByProps({className:'main-reply'}).findByProps({className:'reply-collapse-button'})
    assert.equal(visible().length, 0)
    await act(async () => action().props.onClick())
    assert.equal(visible().length, 3)
    assert.deepEqual(visible().map(item => item.findByProps({className:'reply-content'}).children[0]), ['Reply 0', 'Reply 1', 'Reply 2'])
    const bottom = () => renderer.root.findByProps({className:'reply-pagination'}).findAllByType('button')[0]
    assert.equal(bottom().findByType('span').children[0], 'Show 5 more replies')
    assert.match(bottom().findByType('svg').props.className, /chevron-down/)
    assert.equal(renderer.root.findByProps({className:'reply-pagination'}).findAllByProps({'aria-label':'Collapse replies'}).length, 1)
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Showing \d+ of \d+ replies/)
    await act(async () => bottom().props.onClick())
    assert.equal(visible().length, 8)
    assert.equal(scrolls.length, 0)
    await act(async () => renderer.root.findByProps({className:'reply-pagination'}).findByProps({'aria-label':'Collapse replies'}).props.onClick())
    assert.equal(visible().length, 0)
    assert.deepEqual(focuses.at(-1), {preventScroll:true})
    await act(async () => action().props.onClick())
    await act(async () => bottom().props.onClick())
    for (const count of [13, 18, 23, 28, 33, 38, 43, 48, 50]) {
      await act(async () => bottom().props.onClick())
      assert.equal(visible().length, count)
    }
    assert.equal(bottom().props['aria-label'], 'Collapse replies')
    assert.match(bottom().findByType('svg').props.className, /chevron-up/)
    await act(async () => bottom().props.onClick())
    assert.equal(visible().length, 0)
    assert.deepEqual(scrolls.at(-1), {behavior:'smooth', block:'start'})
    assert.deepEqual(focuses.at(-1), {preventScroll:true})
    reduced = true
    await act(async () => action().props.onClick())
    assert.equal(visible().length, 3)
    await act(async () => action().props.onClick())
    assert.deepEqual(scrolls.at(-1), {behavior:'auto', block:'start'})
    await act(async () => renderer.update(React.createElement(ReplyItem, {...props, newReplyId:'r49'})))
    assert.equal(visible().length, 50)
    await act(async () => renderer.update(React.createElement(ReplyItem, {...props, replies:[root, ...children.slice(0, 2)], newReplyId:null})))
    assert.equal(visible().length, 0)
    assert.equal(action().findByType('span').children.join(''), 'Show all 2 replies')
    await act(async () => action().props.onClick())
    assert.equal(visible().length, 2)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    globalThis.window = oldWindow
    await server.close()
  }
})

test('reply editing stays inline and submits only once while retaining the thread', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT, oldDocument = globalThis.document, oldWindow = globalThis.window
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ReplyItem.jsx')).code
    source = source.replaceAll(JSON.stringify('/node_modules/react/index.js'), JSON.stringify(import.meta.resolve('react')))
    source = source.replace(JSON.stringify('/node_modules/react/jsx-dev-runtime.js'), JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
    source = source.replace(JSON.stringify('/node_modules/lucide-react/dist/esm/lucide-react.mjs'), JSON.stringify(import.meta.resolve('lucide-react')))
    source = source.replace(JSON.stringify('/node_modules/react-dom/index.js'), JSON.stringify(moduleUrl('export const createPortal = element => element')))
    const { default: ReplyItem } = await import(moduleUrl(source))
    const root = { id:'root', author:'Alice', authorId:'me', content:'Original' }
    const child = { id:'child', parentReplyId:'root', author:'Bob', authorId:'me', content:'Child' }
    let resolveSave, calls = [], drafts = {}
    const pending = new Promise(resolve => { resolveSave = resolve })
    const props = { reply:root, replies:[root, child], currentUserId:'me', onReply:()=>{}, onEdit:async (...args)=>{ calls.push(args); await pending }, renderComposer:()=>null,
      onBeginEdit:item=>{ drafts = {...drafts, [item.id]:{original:item.content,text:item.content}}; update() },
      onChangeEdit:(id,text)=>{ drafts = {...drafts,[id]:{...drafts[id],text}}; update() },
      onCancelEdit:id=>{ delete drafts[id]; update() }, onFinishEdit:id=>{ delete drafts[id]; update() } }
    function update() { renderer.update(React.createElement(ReplyItem, {...props, editDrafts:drafts})) }
    await act(async () => { renderer = TestRenderer.create(React.createElement(ReplyItem, {...props, editDrafts:drafts})) })
    const main = () => renderer.root.findByProps({className:'main-reply'})
    await act(async () => main().findByProps({className:'reply-collapse-button'}).props.onClick())
    const childEntry = () => renderer.root.findByProps({className:'subreply'})
    await act(async () => childEntry().findByProps({'aria-label':"More actions for Bob's reply"}).props.onClick())
    await act(async () => childEntry().findByProps({'aria-label':'Reply actions'}).findAllByType('button').find(b=>b.children.includes('Edit')).props.onClick())
    assert.equal(childEntry().findByProps({'aria-label':'Edit reply'}).props.value, 'Child')
    assert.equal(childEntry().findAllByProps({className:'reply-actions'}).length, 0)
    await act(async () => childEntry().findByProps({'aria-label':'Edit reply'}).props.onChange({target:{value:'Changed\ntext'}}))
    const submit = childEntry().findByProps({className:'reply-edit'}).props.onSubmit
    await act(async () => { submit({preventDefault(){}}); submit({preventDefault(){}}) })
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0].parentReplyId, 'root')
    assert.equal(calls[0][1], 'Changed\ntext')
    assert.equal(childEntry().findByProps({className:'reply-submit-button'}).props.disabled, true)
    await act(async () => { resolveSave(); await pending })
    assert.equal(renderer.root.findAllByProps({className:'subreply'}).length, 1)
    await act(async () => main().findByProps({'aria-label':"More actions for Alice's reply"}).props.onClick())
    await act(async () => main().findByProps({'aria-label':'Reply actions'}).findAllByType('button').find(b=>b.children.includes('Edit')).props.onClick())
    assert.equal(main().findByProps({'aria-label':'Edit reply'}).props.value, 'Original')
    await act(async () => main().findByProps({className:'reply-target-cancel'}).props.onClick())
    assert.equal(main().findAllByProps({'aria-label':'Edit reply'}).length, 0)
    const css = await readFile(new URL('../src/pages/PostDetail.css', import.meta.url), 'utf8')
    assert.match(css, /\.reply-edit textarea\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent/)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct; globalThis.document = oldDocument; globalThis.window = oldWindow
    await server.close()
  }
})

test('deleted replies retain thread structure without exposing actions or identity', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT, oldWindow = globalThis.window
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/ReplyItem.jsx')).code
    source = source.replaceAll(JSON.stringify('/node_modules/react/index.js'), JSON.stringify(import.meta.resolve('react')))
    source = source.replace(JSON.stringify('/node_modules/react/jsx-dev-runtime.js'), JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')))
    source = source.replace(JSON.stringify('/node_modules/lucide-react/dist/esm/lucide-react.mjs'), JSON.stringify(import.meta.resolve('lucide-react')))
    source = source.replace(JSON.stringify('/node_modules/react-dom/index.js'), JSON.stringify(moduleUrl('export const createPortal = element => element')))
    const { default: ReplyItem } = await import(moduleUrl(source))
    const root = {id:'root',author:'Deleted reply',content:'',deletedAt:'2026-01-01'}
    const child = {id:'child',parentReplyId:'root',author:'Deleted reply',content:'',deletedAt:'2026-01-01'}
    const descendant = {id:'grandchild',parentReplyId:'child',author:'Survivor',content:'Still here'}
    await act(async () => { renderer = TestRenderer.create(React.createElement(ReplyItem, {reply:root,replies:[root,child,descendant],currentUserId:'owner',renderComposer:()=>null})) })
    const main = renderer.root.findByProps({className:'main-reply'})
    assert.equal(main.findByProps({className:'reply-deleted-content'}).children[0], 'This reply has been deleted.')
    assert.equal(main.findAllByProps({className:'reply-like'}).length, 0)
    assert.equal(main.findAllByProps({className:'reply-menu'}).length, 0)
    await act(async () => main.findByProps({className:'reply-collapse-button'}).props.onClick())
    const subs = renderer.root.findAllByProps({className:'subreply'})
    assert.equal(subs.length, 2)
    assert.equal(subs[0].findAllByProps({className:'reply-menu'}).length, 0)
    assert.match(JSON.stringify(renderer.toJSON()), /replied to.*deleted reply/)
    assert.match(JSON.stringify(renderer.toJSON()), /Still here/)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct; globalThis.window = oldWindow
    await server.close()
  }
})
