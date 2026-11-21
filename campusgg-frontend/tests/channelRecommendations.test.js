import test from 'node:test'
import assert from 'node:assert/strict'
import { channelForGame, selectCommunitySections } from '../src/utils/channelPresentation.js'

test('community recommendations use follows, categories and real counts without duplicates', () => {
  const channels = [
    { id: 'a', name: 'A', category: 'FPS', followerCount: 9 },
    { id: 'b', name: 'B', category: 'MOBA', followerCount: 8 },
    { id: 'c', name: 'C', category: 'MOBA', followerCount: 7 },
    { id: 'd', name: 'D', category: 'FPS', followerCount: 1 },
    { id: 'e', name: 'E', category: 'MOBA', followerCount: 6 },
    { id: 'f', name: 'F', category: 'FPS', followerCount: 0 },
  ]
  const follows = { token: 'user', channels: [{ id: 'a' }], loading: false, error: '' }
  const result = selectCommunitySections(channels, follows)
  assert.equal(result.personalized, true)
  assert.deepEqual(result.mostFollowed.map(channel => channel.id), ['a', 'b', 'c'])
  assert.deepEqual(result.recommended.map(channel => channel.id), ['d', 'f', 'e'])
  assert.ok(!result.recommended.some(channel => channel.id === 'a'))
  const guest = selectCommunitySections(channels, null)
  assert.equal(guest.personalized, false)
  assert.deepEqual(guest.recommended.map(channel => channel.id), ['e', 'd', 'f'])
})


test('historical aliases resolve to the canonical channel identity', () => {
  const catalog = [{ id: 'counter-strike-2', slug: 'counter-strike-2', aliases: ['cs2', 'counter-strike 2'] }]
  assert.equal(channelForGame(catalog, ' Counter-Strike 2 ').id, 'counter-strike-2')
  assert.equal(channelForGame(catalog, 'CS2').id, 'counter-strike-2')
  assert.equal(channelForGame(catalog, 'unknown'), undefined)
})
