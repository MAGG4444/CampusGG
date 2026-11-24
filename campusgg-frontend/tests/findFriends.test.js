import test from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

test('player cards use supplied relationship state and dispatch explicit actions', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  try {
    const { default: FindFriends } = await server.ssrLoadModule('/src/components/FindFriends.jsx')
    const calls = []
    const person = { id: 'test-user', name: 'Test Player', username: 'testplayer', game: 'Chess', suggested: true, relationship: 'none' }
    const render = player => React.createElement(MemoryRouter, null, React.createElement(FindFriends, { people: [player], status: 'ready', onBack() {}, onAction: (item, action) => calls.push([item.id, action]) }))
    await act(async () => { renderer = TestRenderer.create(render(person)) })
    const card = () => renderer.root.findByProps({ className: 'find-friends-row find-player-card' })
    assert.equal(card().findByProps({ className: 'find-card-status' }).children[0], 'Not connected')
    await act(async () => card().findAllByType('button').find(button => button.children.includes('Add Friend')).props.onClick())
    assert.deepEqual(calls, [['test-user', 'request']])
    await act(async () => renderer.update(render({ ...person, relationship: 'outgoing' })))
    assert.equal(card().findByProps({ className: 'find-card-status' }).children[0], 'Pending')
    await act(async () => card().findAllByType('button').find(button => button.children.includes('Cancel Request')).props.onClick())
    assert.deepEqual(calls[1], ['test-user', 'cancel'])
    await act(async () => card().findByProps({ className: 'find-friends-person' }).props.onClick())
    assert.match(JSON.stringify(renderer.toJSON()), /Test Player/)
    assert.match(JSON.stringify(renderer.toJSON()), /Request pending/)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})

test('suggested players can switch games and name the active game in empty and profile states', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  let renderer
  try {
    const { default: FindFriends } = await server.ssrLoadModule('/src/components/FindFriends.jsx')
    const changes = []
    const render = props => React.createElement(MemoryRouter, null, React.createElement(FindFriends, {
      people: [],
      status: 'ready',
      games: ['League of Legends', 'Dota 2'],
      selectedGame: 'League of Legends',
      onGameChange: game => changes.push(game),
      onBack() {},
      ...props,
    }))
    await act(async () => { renderer = TestRenderer.create(render()) })
    const select = () => renderer.root.findByProps({ 'aria-label': 'Suggested players game' })
    assert.equal(select().props.value, 'League of Legends')
    assert.match(JSON.stringify(renderer.toJSON()), /No compatible League of Legends players yet/)
    await act(async () => select().props.onChange({ target: { value: 'Dota 2' } }))
    assert.deepEqual(changes, ['Dota 2'])
    await act(async () => renderer.update(render({ status: 'profile', missingGame: 'Overwatch 2' })))
    const profileCopy = JSON.stringify(renderer.toJSON())
    assert.match(profileCopy, /Overwatch 2/)
    assert.match(profileCopy, /to your profile to see suggestions/)
    await act(async () => renderer.update(render({ games: ['Dota 2'], selectedGame: 'Dota 2' })))
    assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Suggested players game' }).length, 0)
    assert.match(JSON.stringify(renderer.toJSON()), /find-player-game-label/)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    await server.close()
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})
