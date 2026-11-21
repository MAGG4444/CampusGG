import test from 'node:test'
import assert from 'node:assert/strict'
import { rememberForumFeed, takeForumFeed, clearForumFeed, consumeForumRestore } from '../src/utils/forumFeedReturn.js'

test('feed restoration is scoped to account and route and consumed once', () => {
  const snapshot = { account: 'alice', route: '/forum/channel/cs2', tab: 'following', search: 'guide', sort: 'new', scrollY: 1700, anchorId: 'p60' }
  rememberForumFeed(snapshot)
  assert.equal(takeForumFeed('bob', snapshot.route, true), null)
  rememberForumFeed(snapshot)
  assert.equal(takeForumFeed('alice', '/forum', true), null)
  rememberForumFeed(snapshot)
  assert.equal(takeForumFeed('alice', snapshot.route, false), null)
  rememberForumFeed(snapshot)
  assert.equal(takeForumFeed('alice', snapshot.route, true), snapshot)
  clearForumFeed(snapshot)
  assert.equal(takeForumFeed('alice', snapshot.route, true), null)
  assert.equal(consumeForumRestore(snapshot), true)
  assert.equal(consumeForumRestore(snapshot), false)
})
