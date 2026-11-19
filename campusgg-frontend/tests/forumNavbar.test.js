import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const react = JSON.stringify(import.meta.resolve('react'))

test('forum is one navigation link and hover or keyboard opens channels', async () => {
  const oldStorage = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem: () => null }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/components/Navbar.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl(`import React from ${react}; export const useLocation=()=>({}); export const Link=p=>React.createElement('a',{href:p.to,onClick:p.onClick},p.children); export const NavLink=p=>React.createElement('a',{...p,href:p.to},p.children)`))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/src/context/useAuth.js', moduleUrl('export const useAuth=()=>({isAuthenticated:false})'))
    replace('/src/context/forumChannelsContext.js', moduleUrl('export const useForumChannels=()=>({channels:[{id:"1",slug:"game",name:"Game"}]})'))
    replace('/src/components/ChannelLogo.jsx', moduleUrl('export default function Logo(){return null}'))
    source = source.replace(/^import .*\.css.*$/gm, '')
    const { default: Navbar } = await import(moduleUrl(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(Navbar)) })
    const forum = renderer.root.findByProps({ href: '/forum' })
    assert.equal(forum.props['aria-expanded'], false)
    assert.equal(renderer.root.findAllByProps({ className: 'nav-forum-toggle' }).length, 0)
    const region = () => renderer.root.findAllByType('div').find(node => node.props.className?.startsWith('nav-forum '))
    await act(async () => region().props.onMouseEnter())
    assert.equal(forum.props['aria-expanded'], true)
    assert.match(region().props.className, /is-open/)
    assert.equal(renderer.root.findByProps({ href: '/forum/channel/game' }).children.at(-1), 'Game')
    let focused = false
    await act(async () => region().props.onKeyDown({ key: 'Escape', currentTarget: { querySelector: () => ({ focus: () => { focused = true } }) } }))
    assert.equal(forum.props['aria-expanded'], false)
    assert.equal(focused, true)
    const oldFrame = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (callback) => callback()
    let prevented = false
    focused = false
    try {
      await act(async () => forum.props.onKeyDown({ key: 'ArrowDown', preventDefault: () => { prevented = true }, currentTarget: { parentElement: { querySelector: () => ({ focus: () => { focused = true } }) } } }))
      assert.equal(prevented, true)
      assert.equal(forum.props['aria-expanded'], true)
      assert.equal(focused, true)
      assert.equal(forum.props.href, '/forum')
    } finally { globalThis.requestAnimationFrame = oldFrame }
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.sessionStorage = oldStorage
    delete globalThis.IS_REACT_ACT_ENVIRONMENT
    await server.close()
  }
})

test('dropdown surface is anchored to Forum and joins its trigger', async () => {
  const css = await readFile(new URL('../src/components/Navbar.css', import.meta.url), 'utf8')
  assert.match(css, /\.nav-forum-menu\s*\{[^}]*left:\s*0;/)
  assert.match(css, /\.nav-forum\.is-open\s*>\s*\.nav-link\s*\{[^}]*border-bottom-color:\s*transparent/)
  assert.match(css, /\.nav-forum\.is-open::after\s*\{/)
  assert.match(css, /\.nav-forum-menu\s*\{[^}]*top:\s*calc\(100% - 1px\)/)
})
