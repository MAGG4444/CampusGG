import test from 'node:test'
import assert from 'node:assert/strict'
import { messageGroupPositions } from '../src/utils/messageGroups.js'

const message = (id, senderId, createdAt) => ({ id, senderId, createdAt })
const positions = (messages, unread) => messageGroupPositions(messages, unread).map(({ startsGroup, endsGroup }) => [startsGroup, endsGroup])

test('groups the same sender up to five minutes and uses the last timestamp', () => {
  const messages = [message('1', 'a', '2026-11-21T10:00:00Z'), message('2', 'a', '2026-11-21T10:05:00Z'), message('3', 'a', '2026-11-21T10:10:01Z')]
  assert.deepEqual(positions(messages), [[true, false], [false, true], [true, true]])
})

test('sender changes, date boundaries, unread dividers and missing times start groups', () => {
  const late = new Date(2026, 10, 21, 23, 59).toISOString()
  const early = new Date(2026, 10, 22, 0, 0).toISOString()
  const messages = [message('1', 'a', late), message('2', 'b', late), message('3', 'b', early), message('4', 'b', early), message('5', 'b', null)]
  assert.deepEqual(positions(messages, '4'), [[true, true], [true, true], [true, true], [true, true], [true, true]])
})

test('appending a message updates the prior group end without changing messages', () => {
  const first = message('1', 'a', '2026-11-21T10:00:00Z')
  const second = message('2', 'a', '2026-11-21T10:01:00Z')
  assert.deepEqual(positions([first]), [[true, true]])
  assert.deepEqual(positions([first, second]), [[true, false], [false, true]])
  assert.equal(first.createdAt, '2026-11-21T10:00:00Z')
})
