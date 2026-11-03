import test from 'node:test'
import assert from 'node:assert/strict'
import { canShowConnectionSidebar } from '../src/utils/connectionSidebar.js'

test('connection sidebar is available only to authenticated users', () => {
  assert.equal(canShowConnectionSidebar(true, '/lobby'), true)
  assert.equal(canShowConnectionSidebar(false, '/lobby'), false)
})

test('connection sidebar stays hidden on authentication routes', () => {
  for (const pathname of ['/signin', '/signup', '/verify-email']) {
    assert.equal(canShowConnectionSidebar(true, pathname), false)
  }
})
