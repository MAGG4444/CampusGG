import test from 'node:test'
import assert from 'node:assert/strict'
import { getConnections, searchPlayers, changeConnection } from '../src/api/connections.js'

const person = relationship => ({ id: 'target', username: 'player', name: 'Player', relationship })
const response = data => ({ ok: true, json: async () => data })

test('loads authenticated friends, incoming and outgoing requests', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname
    calls.push(path)
    assert.equal(options.headers.Authorization, 'Bearer token')
    return response({ items: [person(path.endsWith('/incoming') ? 'incoming' : path.endsWith('/outgoing') ? 'outgoing' : 'friend')] })
  }
  const result = await getConnections('token', { fetchImpl })
  assert.deepEqual(calls.sort(), ['/connections', '/connections/incoming', '/connections/outgoing'])
  assert.equal(result.friends[0].relationship, 'friend')
  assert.equal(result.incoming[0].relationship, 'incoming')
  assert.equal(result.outgoing[0].relationship, 'outgoing')
})

test('encodes search and rejects invalid list responses', async () => {
  const items = await searchPlayers('token', ' A&B ', { fetchImpl: async url => {
    assert.equal(new URL(url).searchParams.get('q'), 'A&B')
    return response({ items: [person('none')] })
  } })
  assert.equal(items[0].id, 'target')
  await assert.rejects(getConnections('token', { fetchImpl: async () => response({ items: null }) }), /Invalid connections/)
})

test('all five friendship mutations use correct routes and methods', async () => {
  for (const [action, method, suffix, relationship] of [
    ['request', 'POST', '/request/target', 'outgoing'],
    ['accept', 'PATCH', '/accept/target', 'friend'],
    ['decline', 'DELETE', '/decline/target', 'none'],
    ['cancel', 'DELETE', '/cancel/target', 'none'],
    ['remove', 'DELETE', '/target', 'none'],
  ]) {
    const data = await changeConnection('token', 'target', action, { fetchImpl: async (url, options) => {
      assert.equal(new URL(url).pathname, `/connections${suffix}`)
      assert.equal(options.method, method)
      assert.equal(options.headers.Authorization, 'Bearer token')
      return response({ userId: 'target', relationship })
    } })
    assert.equal(data.relationship, relationship)
  }
  await assert.rejects(changeConnection('token', 'target', 'invalid'), /Invalid connection action/)
})
