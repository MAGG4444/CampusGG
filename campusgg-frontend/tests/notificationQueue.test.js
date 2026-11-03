import test from 'node:test'
import assert from 'node:assert/strict'
import { enqueueNotification, MAX_VISIBLE_NOTIFICATIONS } from '../src/components/notifications/notificationQueue.js'

test('urgent notifications are queued ahead of waiting informational notifications', () => {
  const first = { id: '1', type: 'info' }
  const second = { id: '2', type: 'success' }
  const waiting = { id: '3', type: 'info' }
  const error = { id: '4', type: 'error' }
  const queue = enqueueNotification([first, second, waiting], error)
  assert.equal(MAX_VISIBLE_NOTIFICATIONS, 2)
  assert.deepEqual(queue.map((item) => item.id), ['1', '2', '4', '3'])
  assert.equal(queue.filter((item) => item.type === 'error').length, 1)
})
