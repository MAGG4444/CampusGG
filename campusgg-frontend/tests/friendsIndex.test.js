import test from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { groupFriends } from '../src/utils/friendGroups.js'

test('friend groups sort accepted names and put non-Latin initials in #', () => {
  const people = [{ name: 'zoe', relationship: 'friend' }, { name: 'alice', relationship: 'friend' }, { name: 'Adam', relationship: 'friend' }, { name: 'ſam', relationship: 'friend' }, { name: 'Émile', relationship: 'friend' }, { name: '2fast', relationship: 'friend' }, { name: 'Ben', relationship: 'incoming' }]
  const groups = groupFriends(people)
  assert.deepEqual(groups.map(([letter]) => letter), ['A', 'Z', '#'])
  assert.deepEqual(groups[0][1].map(person => person.name), ['Adam', 'alice'])
  assert.equal(groups[2][1].length, 3)
})

test('index navigates available groups and reacts to refreshed friends', async () => {
  const oldWindow = globalThis.window
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.window = { matchMedia: () => ({ matches: true }) }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  let wheel
  const scrollCalls = []
  const list = { scrollTop: 0, clientHeight: 100, scrollHeight: 400, getBoundingClientRect: () => ({ top: 0 }), scrollTo: options => scrollCalls.push(options) }
  try {
    const { default: FriendsIndex } = await server.ssrLoadModule('/src/components/FriendsIndex.jsx')
    const row = person => React.createElement('li', { key: person.id }, person.name)
    const people = [{ id: 'a', name: 'Ada', relationship: 'friend' }, { id: 'm', name: 'Mia', relationship: 'friend' }]
    const props = { people, renderFriend: row }
    await act(async () => { renderer = TestRenderer.create(React.createElement(FriendsIndex, props), { createNodeMock: element => {
      if (element.props.className === 'friends-index-list') return list
      if (element.props.className === 'friends-index-nav') return { addEventListener: (_, fn) => { wheel = fn }, removeEventListener() {} }
      if (element.type === 'section') return { getBoundingClientRect: () => ({ top: element.props.children[0].props.children === 'A' ? 0 : 180 }) }
      return null
    } }) })
    const get = label => renderer.root.findByProps({ 'aria-label': `Jump to ${label}` })
    assert.equal(get('B').props['aria-disabled'], true)
    await act(async () => get('M').props.onPointerEnter({ pointerType: 'mouse' }))
    assert.deepEqual(scrollCalls.at(-1), { top: 180, behavior: 'auto' })
    await act(async () => get('A').props.onClick())
    assert.equal(get('A').props['aria-current'], 'true')
    await act(async () => wheel({ deltaY: 1, preventDefault() {} }))
    assert.equal(get('M').props['aria-current'], 'true')
    await act(async () => renderer.update(React.createElement(FriendsIndex, { ...props, people: [{ id: 'm', name: 'Zia', relationship: 'friend' }, { id: 'new', name: '7up', relationship: 'friend' }] })))
    assert.equal(get('A').props['aria-disabled'], true)
    assert.equal(get('Z').props['aria-disabled'], false)
    assert.equal(get('#').props['aria-disabled'], false)
    assert.deepEqual(renderer.root.findAllByType('h3').map(item => item.children[0]), ['Z', '#'])
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.window = oldWindow
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})
