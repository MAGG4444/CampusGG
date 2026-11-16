import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'

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
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const useParams=()=>({slug:globalThis.__postTest.slug}); export const useLocation=()=>({search:'',state:null}); export const useNavigate=()=>path=>globalThis.__postTest.navigate.push(path); export const Link=p=>React.createElement('a',{href:p.to},p.children)`))
    replace('/src/utils/myContentNavigation.js', moduleUrl("export const draftEditorReturnTo=(_location,fallback)=>fallback"))
    replace('/src/context/useAuth.js', moduleUrl("export const useAuth=()=>({token:'token'})"))
    replace('/src/hooks/useDraftEditor.js', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export function useDraftEditor(type,publishing,initial) { const [formData,setFormData]=React.useState({title:'Test title', content:'Text', game:'', ...initial}); return {formData,setFormData,statusMessage:'',setStatusMessage:()=>{},blocked:false,hasSavedDraft:false,save:()=>{},discard:()=>true,completePublish:()=>{},navigationBlocker:{state:'unblocked'}} }`))
    replace('/src/components/DraftNavigationDialog.jsx', moduleUrl('export default function Dialog(){return null}'))
    replace('/src/api/forum.js', moduleUrl("export async function createForumPost(payload){globalThis.__postTest.payload=payload;return {id:'post-id'}}"))
    source = source.replace(/import ".*?\.css";/g, '')
    source = source.replace(/import logo from [^;]+;/, 'const logo="logo";')
    const { default: CreatePost } = await import(moduleUrl(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(CreatePost)); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /Posting in Valorant/)
    assert.equal(renderer.root.findAllByType('select').length, 0)
    await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    assert.equal(globalThis.__postTest.payload.channelSlug, 'valorant')
    assert.equal(globalThis.__postTest.navigate.at(-1), '/forum/post-id')
    await act(async () => { renderer.unmount() })
    globalThis.__postTest.slug = undefined
    await act(async () => { renderer = TestRenderer.create(React.createElement(CreatePost)); await tick() })
    assert.match(JSON.stringify(renderer.toJSON()), /Choose a game channel/)
    assert.equal(renderer.root.findAllByType('form').length, 0)
    assert.ok(renderer.root.findAllByType('a').some(link => link.props.href === '/forum/channel/valorant'))
    await act(async () => { renderer.unmount() })
  } finally {
    globalThis.fetch = oldFetch
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    delete globalThis.__postTest
    await server.close()
  }
})
