import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('post editor requires a channel and submits the route channel', async () => {
  const oldFetch = globalThis.fetch
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.__postTest = { slug: 'valorant', navigate: [] }
  globalThis.fetch = async () => ({ ok: true, json: async () => [{ id: 'valorant', slug: 'valorant', name: 'Valorant', aliases: ['valorant'] }] })
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/pages/CreatePost.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/src/components/ChannelLogo.jsx', moduleUrl('export default function Logo(){return null}'))
    replace('/src/context/forumChannelsContext.js', moduleUrl('export const useForumChannels=()=>({channels:[{id:"valorant",slug:"valorant",name:"Valorant",aliases:["valorant"]}],error:"",retry:()=>{}})'))
    replace('/src/hooks/useInfiniteForumFeed.js', moduleUrl('export const invalidateForumFeedCache=()=>{}'))
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const useParams=()=>({slug:globalThis.__postTest.slug}); export const useLocation=()=>({search:'',state:null}); export const useNavigate=()=>path=>globalThis.__postTest.navigate.push(path); export const Link=p=>React.createElement('a',{href:p.to,className:p.className},p.children)`))
    replace('/src/utils/myContentNavigation.js', moduleUrl("export const draftEditorReturnTo=(_location,fallback)=>fallback"))
    replace('/src/context/useAuth.js', moduleUrl("export const useAuth=()=>({token:'token'})"))
    replace('/src/hooks/useDraftEditor.js', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export function useDraftEditor(type,publishing,initial) { const [formData,setFormData]=React.useState({title:'Test title', content:'Text', game:'', ...initial, ...globalThis.__postTest.draft}); return {formData,setFormData,statusMessage:'',setStatusMessage:()=>{},blocked:false,hasSavedDraft:Boolean(globalThis.__postTest.draft),save:()=>{},discard:()=>true,completePublish:()=>{},navigationBlocker:{state:'unblocked'}} }`))
    replace('/src/components/DraftNavigationDialog.jsx', moduleUrl('export default function Dialog(){return null}'))
    replace('/src/api/forum.js', moduleUrl("export async function createForumPost(payload){globalThis.__postTest.payload=payload;globalThis.__postTest.calls=(globalThis.__postTest.calls||0)+1;if(globalThis.__postTest.pending)await globalThis.__postTest.pending;return {id:'post-id'}}"))
    source = source.replace(/import ".*?\.css";/g, '')
    source = source.replace(/import logo from [^;]+;/, 'const logo="logo";')
    const { default: CreatePost } = await import(moduleUrl(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(CreatePost)); await tick() })
    assert.equal(renderer.root.findAllByType('h1').length, 0)
    const header = renderer.root.findByProps({ className: 'create-post-header' })
    assert.deepEqual(header.children.map(child => child.props.className), ['back-button create-post-back-button', 'create-post-title-main', 'create-post-channel-control', 'editor-drafts-link'])
    assert.equal(header.findByProps({ id: 'post-title' }).props.placeholder, 'Type a title')
    assert.equal(header.findByProps({ id: 'post-title' }).props.value, 'Test title')
    assert.equal(renderer.root.findByProps({ id: 'post-content' }).props.placeholder, 'Write your post...')
    assert.equal(renderer.root.findAllByType('label').find(label => label.props.htmlFor === 'post-content').props.className, 'sr-only')
    assert.equal(renderer.root.findAllByType('a').find((link) => link.props.className === 'editor-drafts-link').props.href, '/my-content?tab=drafts')
    const fixed = renderer.root.findByProps({ id: 'post-channel' })
    assert.equal(header.findByProps({ id: 'post-channel' }).props.readOnly, true)
    assert.equal(header.findAllByType('label').find(label => label.props.htmlFor === 'post-channel').props.className, 'sr-only')
    assert.equal(fixed.props.value, 'Valorant')
    assert.equal(fixed.props.readOnly, true)
    assert.match(fixed.props.className, /is-selected/)
    assert.notEqual(fixed.props.required, true)
    assert.equal(renderer.root.findAllByType('select').length, 0)
    await act(async () => header.findByProps({ id: 'post-title' }).props.onChange({ target: { value: 'Updated title' } }))
    let resolvePublish
    globalThis.__postTest.pending = new Promise(resolve => { resolvePublish = resolve })
    await act(async () => { const submit = renderer.root.findByType('form').props.onSubmit; void submit({ preventDefault() {} }); void submit({ preventDefault() {} }) })
    assert.equal(globalThis.__postTest.calls, 1)
    await act(async () => { resolvePublish(); await globalThis.__postTest.pending })
    globalThis.__postTest.pending = null
    assert.equal(globalThis.__postTest.payload.title, 'Updated title')
    assert.equal(globalThis.__postTest.payload.channelSlug, 'valorant')
    assert.equal(globalThis.__postTest.navigate.at(-1), '/forum/post-id')
    await act(async () => { renderer.unmount() })
    globalThis.__postTest.slug = undefined
    await act(async () => { renderer = TestRenderer.create(React.createElement(CreatePost)); await tick() })
    const fields = renderer.root.findByProps({ className: 'create-post-header' })
    assert.equal(renderer.root.findByProps({ id: 'post-title' }).props.value, 'Test title')
    assert.equal(fields.findByProps({ id: 'post-channel' }).props.required, true)
    assert.equal(renderer.root.findByProps({ id: 'post-channel' }).props.value, '')
    assert.doesNotMatch(renderer.root.findByProps({ id: 'post-channel' }).props.className, /is-selected/)
    assert.equal(renderer.root.findByProps({ type: 'submit' }).props.disabled, true)
    await act(async () => renderer.root.findByProps({ id: 'post-channel' }).props.onChange({ target: { value: 'valorant' } }))
    assert.match(renderer.root.findByProps({ id: 'post-channel' }).props.className, /is-selected/)
    assert.equal(renderer.root.findByProps({ type: 'submit' }).props.disabled, false)
    await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    assert.equal(globalThis.__postTest.payload.channelSlug, 'valorant')
    await act(async () => { renderer.unmount() })
    globalThis.__postTest.draft = { channelSlug: '', game: 'unknown legacy game' }
    await act(async () => { renderer = TestRenderer.create(React.createElement(CreatePost)); await tick() })
    assert.equal(renderer.root.findByProps({ id: 'post-channel' }).props.value, '')
    assert.equal(renderer.root.findByProps({ type: 'submit' }).props.disabled, true)
    await act(async () => { renderer.unmount() })
  } finally {
    globalThis.fetch = oldFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    delete globalThis.__postTest
    await server.close()
  }
})

test('editor uses borderless writing fields and outlined drafts link', async () => {
  const css = await readFile(new URL('../src/pages/CreatePost.css', import.meta.url), 'utf8')
  assert.match(css, /\.create-post-header\s*\{[^}]*display:\s*flex/)
  assert.match(css, /\.create-post-title-main\s*\{[^}]*min-width:\s*0;\s*flex:\s*1/)
  assert.match(css, /\.create-post-channel-control\s*\{[^}]*flex:\s*0 1 190px/)
  assert.match(css, /@container \(max-width: 620px\)[\s\S]*?\.create-post-header\s*\{\s*flex-wrap:\s*wrap/)
  assert.match(css, /\.create-post-header \.editor-drafts-link:visited\s*\{[^}]*border-color:\s*var\(--border-strong\)/)
  assert.match(css, /\.create-post-page \.create-title-input\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*color:\s*var\(--gold-bright\)/)
  assert.match(css, /\.create-post-page \.create-post-content-input\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent/)
  assert.match(css, /\.create-post-channel-input\.is-selected\s*\{[^}]*color:\s*var\(--gold-bright\)/)
  assert.match(css, /\.create-post-channel-input\s*\{[^}]*color:\s*var\(--muted\)/)
  assert.match(css, /\.create-post-page \.create-title-input:-webkit-autofill\s*\{[^}]*-webkit-text-fill-color:\s*var\(--gold-bright\)/)
  for (const selector of ['create-title-input', 'create-post-content-input']) {
    assert.match(css, new RegExp(`\\.create-post-page \\.${selector}:focus-visible\\s*\\{[^}]*outline:\\s*none;[^}]*box-shadow:`))
  }
  assert.match(css, /\.create-post-page \.create-post-channel-input:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--gold-bright\)/)
  for (const selector of ['create-title-input', 'create-post-content-input']) {
    assert.match(css, new RegExp(`\\.create-post-page \\.${selector}:focus-visible\\s*\\{[^}]*box-shadow:\\s*none`))
    assert.doesNotMatch(css.match(new RegExp(`\\.create-post-page \\.${selector}:focus-visible\\s*\\{([^}]*)\\}`))[1], /text-decoration|border|background|color/)
    assert.doesNotMatch(css, new RegExp(`\\.${selector}:focus-visible::placeholder`))
    assert.doesNotMatch(css, new RegExp(`:has\\(> \\.${selector}:focus-visible\\)::after`))
  }
  assert.match(css, /\.create-post-content-group\s*\{[^}]*border-top:\s*1px solid var\(--border\)/)
  assert.doesNotMatch(css.match(/\.create-post-actions\s*\{([^}]*)\}/)[1], /border-top/)
  const sharedCss = await readFile(new URL('../src/pages/CreateLobby.css', import.meta.url), 'utf8')
  assert.match(sharedCss, /\.create-actions\s*\{[^}]*border-top:\s*1px solid var\(--border\)/)
})
