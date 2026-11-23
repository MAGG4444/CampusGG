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
