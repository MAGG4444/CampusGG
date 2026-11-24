import test from 'node:test'
import assert from 'node:assert/strict'
import { subscribeDirectMessages } from '../src/api/directMessageSocket.js'

test('private socket authenticates and coalesces refreshes; cleanup removes listeners', async () => {
  const listeners = new Map()
  let connected = 0, disconnected = 0, refreshed = 0
  const fake = {
    on(event, fn) { listeners.set(event, fn) },
    off(event, fn) { assert.equal(listeners.get(event), fn); listeners.delete(event) },
    connect() { connected++ }, disconnect() { disconnected++ },
  }
  const stop = subscribeDirectMessages('secret', () => refreshed++, (url, options) => {
    assert.equal(url, 'https://campusgg.net/direct-messages')
    assert.deepEqual(options.auth, { token: 'secret' })
    assert.equal(options.path, '/socket.io')
    assert.equal(options.autoConnect, false)
    return fake
  }, { VITE_API_URL: 'https://campusgg.net/api' })
  assert.equal(connected, 1)
  listeners.get('direct-messages:ready')()
  listeners.get('direct-messages:changed')()
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(refreshed, 1)
  listeners.get('direct-messages:changed')()
  stop()
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(refreshed, 1)
  assert.equal(listeners.size, 0)
  assert.equal(disconnected, 1)
})

test('no socket is created for anonymous visitors', () => {
  const stop = subscribeDirectMessages(null, () => {}, () => assert.fail('unexpected connection'))
  stop()
})
