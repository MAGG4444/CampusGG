import test from 'node:test'
import assert from 'node:assert/strict'
import { profilePayload, profileValues, sessionWithProfile, validateProfile } from '../src/utils/profile.js'
import { getCurrentUser, updateUserProfile } from '../src/api/users.js'

const fields = { displayName: 'Player', bio: 'Bio', favoriteGames: ['Valorant'], skillLevel: 'Intermediate' }
const session = { token: 'original-token', user: { id: 'alice', username: 'alice', email: 'alice@example.edu', ...fields } }

test('profile inputs enforce limits, required names, unique games and listed skills', () => {
  assert.deepEqual(validateProfile(fields), {})
  for (const [field, value] of [
    ['displayName', '  '], ['displayName', 'x'.repeat(101)], ['bio', 'x'.repeat(501)],
    ['favoriteGames', ['Valorant', ' valorant ']], ['favoriteGames', ['']],
    ['favoriteGames', ['x'.repeat(51)]], ['favoriteGames', Array.from({ length: 11 }, (_, i) => `Game ${i}`)],
    ['favoriteGames', 'not an array'], ['skillLevel', 'Expert'],
  ]) assert.ok(validateProfile({ ...fields, [field]: value })[field], field)
  assert.deepEqual(profilePayload({ ...fields, displayName: ' Player ', bio: '', favoriteGames: [], skillLevel: '', token: 'secret' }),
    { displayName: 'Player', bio: '', favoriteGames: [], skillLevel: '' })
})

test('prefilled values are independent copies and cancel can restore original values', () => {
  const values = profileValues(session.user)
  values.favoriteGames.push('Minecraft')
  values.displayName = 'Edited'
  assert.deepEqual(profileValues(session.user), fields)
})

test('profile API sends only editable fields and returns validated server values', async () => {
  const saved = await updateUserProfile({ ...fields, username: 'intruder', token: 'secret' }, session.token, async (url, options) => {
    assert.ok(url.endsWith('/users/me'))
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer original-token')
    assert.deepEqual(JSON.parse(options.body), fields)
    return new Response(JSON.stringify({ id: 'alice', ...fields, displayName: 'Server Name', password: 'secret' }), { status: 200 })
  })
  assert.deepEqual(saved, { id: 'alice', ...fields, displayName: 'Server Name' })
})

test('successful profile application preserves identity and token; wrong accounts are rejected', () => {
  const updated = sessionWithProfile(session, { id: 'alice', ...fields, displayName: 'Updated', email: 'changed', username: 'changed', token: 'changed' })
  assert.equal(updated.user.displayName, 'Updated')
  assert.equal(updated.token, session.token)
  assert.equal(updated.user.email, session.user.email)
  assert.equal(updated.user.username, session.user.username)
  assert.equal(session.user.displayName, 'Player')
  assert.throws(() => sessionWithProfile(session, { id: 'bob', ...fields }))
  assert.throws(() => sessionWithProfile(session, { id: 'alice', displayName: 'Incomplete' }))
})

test('failed and malformed responses never mutate the previous profile', async () => {
  const original = JSON.stringify(session)
  for (const response of [
    new Response(JSON.stringify({ message: ['Invalid name', 'Try again'] }), { status: 400 }),
    new Response('offline', { status: 500 }),
    new Response('{}', { status: 200 }),
    new Response(JSON.stringify({ id: 'alice', ...fields, favoriteGames: null }), { status: 200 }),
  ]) await assert.rejects(updateUserProfile(fields, session.token, async () => response))
  await assert.rejects(updateUserProfile(fields, session.token, async () => { throw new Error('Network failure') }))
  assert.equal(JSON.stringify(session), original)
})

test('missing authentication and invalid input never send a request', async () => {
  const unexpectedRequest = () => { assert.fail('Should not send a request') }
  await assert.rejects(updateUserProfile(fields, '', unexpectedRequest))
  await assert.rejects(updateUserProfile({ ...fields, displayName: '' }, session.token, unexpectedRequest))
})

test('profile retrieval uses the authenticated me endpoint and rejects incomplete responses', async () => {
  const account = await getCurrentUser(session.token, async (url, options) => {
    assert.ok(url.endsWith('/users/me'))
    assert.equal(options.headers.Authorization, 'Bearer original-token')
    return new Response(JSON.stringify({ ...session.user, password: 'secret' }))
  })
  assert.deepEqual(account, session.user)
  await assert.rejects(getCurrentUser(session.token, async () => new Response('{}')))
  await assert.rejects(getCurrentUser(session.token, async () => new Response('{}', { status: 401 })))
})
