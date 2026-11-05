import test from 'node:test'
import assert from 'node:assert/strict'
import { isGroupedMessage, isNearBottom, newMessageIds, shouldSendOnKey, uniqueMessages } from '../src/utils/lobbyChatView.js'

test('detects whether a reader is near the bottom', () => {
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 440, clientHeight: 500 }), true)
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 200, clientHeight: 500 }), false)
})

test('poll responses count only previously unseen message IDs', () => {
  const known = new Set(['a', 'b'])
  assert.deepEqual(newMessageIds(known, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]), ['c'])
  known.add('c')
  assert.deepEqual(newMessageIds(known, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]), [])
  assert.deepEqual(uniqueMessages([{ id: 'a' }, { id: 'a' }, { id: 'b' }]), [{ id: 'a' }, { id: 'b' }])
})

test('groups only adjacent messages from the same sender within five minutes', () => {
  const message = (id, createdAt) => ({ sender: { id }, createdAt })
  const first = message('a', '2026-11-04T12:00:00Z')
  assert.equal(isGroupedMessage(first, message('a', '2026-11-04T12:04:00Z')), true)
  assert.equal(isGroupedMessage(first, message('a', '2026-11-04T12:06:00Z')), false)
  assert.equal(isGroupedMessage(first, message('b', '2026-11-04T12:01:00Z')), false)
  assert.equal(isGroupedMessage(null, first), false)
})

test('Enter sends, while Shift+Enter and IME composition do not', () => {
  assert.equal(shouldSendOnKey({ key: 'Enter' }), true)
  assert.equal(shouldSendOnKey({ key: 'Enter', shiftKey: true }), false)
  assert.equal(shouldSendOnKey({ key: 'Enter', isComposing: true }), false)
  assert.equal(shouldSendOnKey({ key: 'Enter', keyCode: 229 }), false)
})
