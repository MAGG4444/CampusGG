import test from 'node:test'
import assert from 'node:assert/strict'
import {
  profilePayload,
  profileValues,
  rolesForGame,
  sessionWithProfile,
  validateProfile,
} from '../src/utils/profile.js'
import { getCurrentUser, updateUserProfile } from '../src/api/users.js'

const fields = {
  displayName: 'Player',
  bio: 'Bio',
  gamingProfiles: [
    {
      game: 'Valorant',
      preferredRoles: ['Controller', 'Sentinel'],
      experienceLevel: 'Intermediate',
    },
    {
      game: 'Minecraft',
      preferredRoles: ['Strategist'],
      experienceLevel: 'Advanced',
    },
  ],
}
const session = {
  token: 'original-token',
  user: {
    id: 'alice',
    username: 'alice',
    email: 'alice@example.edu',
    ...fields,
  },
}

test('gaming profiles validate per-game roles and independent experience', () => {
  assert.deepEqual(validateProfile(fields), {})
  assert.deepEqual(rolesForGame('valorant'), [
    'Duelist', 'Initiator', 'Controller', 'Sentinel',
  ])
  assert.deepEqual(rolesForGame('Minecraft'), [
    'Leader', 'Strategist', 'Support', 'Flex',
  ])

  for (const values of [
    { ...fields, displayName: '  ' },
    { ...fields, displayName: 'x'.repeat(101) },
    { ...fields, bio: 'x'.repeat(501) },
    { ...fields, gamingProfiles: [fields.gamingProfiles[0], {
      ...fields.gamingProfiles[0], game: ' valorant ',
    }] },
    { ...fields, gamingProfiles: [{
      game: 'Valorant', preferredRoles: ['Support'], experienceLevel: 'Beginner',
    }] },
    { ...fields, gamingProfiles: [{
      game: 'Valorant', preferredRoles: [], experienceLevel: 'Expert',
    }] },
  ]) {
    assert.ok(Object.keys(validateProfile(values)).length)
  }
})

test('empty roles and empty gaming profiles are supported', () => {
  assert.deepEqual(validateProfile({
    ...fields,
    gamingProfiles: [{
      game: 'Overwatch 2', preferredRoles: [], experienceLevel: 'Beginner',
    }],
  }), {})
  assert.deepEqual(profilePayload({ ...fields, gamingProfiles: [] }), {
    displayName: 'Player',
    bio: 'Bio',
    gamingProfiles: [],
  })
})

test('profile values deep copy structured games and adapt legacy records', () => {
  const values = profileValues(session.user)
  values.gamingProfiles[0].preferredRoles.push('Duelist')
  assert.deepEqual(profileValues(session.user), fields)

  assert.deepEqual(profileValues({
    displayName: 'Legacy', bio: '', favoriteGames: ['Valorant'],
    skillLevel: 'Intermediate',
    preferredRoles: [{ game: 'Valorant', roles: ['Controller'] }],
  }).gamingProfiles, [{
    game: 'Valorant',
    preferredRoles: ['Controller'],
    experienceLevel: 'Intermediate',
  }])
})

test('profile API sends only editable structured fields', async () => {
  const saved = await updateUserProfile(
    { ...fields, username: 'intruder', token: 'secret' },
    session.token,
    async (url, options) => {
      assert.ok(url.endsWith('/users/me'))
      assert.equal(options.method, 'PATCH')
      assert.equal(options.headers.Authorization, 'Bearer original-token')
      assert.deepEqual(JSON.parse(options.body), fields)
      return new Response(JSON.stringify({
        id: 'alice',
        ...fields,
        displayName: 'Server Name',
        password: 'secret',
      }), { status: 200 })
    },
  )
  assert.deepEqual(saved, { id: 'alice', ...fields, displayName: 'Server Name' })
})

test('successful session updates preserve identity and token', () => {
  const updated = sessionWithProfile(session, {
    id: 'alice',
    ...fields,
    displayName: 'Updated',
    email: 'changed',
    username: 'changed',
    token: 'changed',
  })
  assert.equal(updated.user.displayName, 'Updated')
  assert.equal(updated.token, session.token)
  assert.equal(updated.user.email, session.user.email)
  assert.equal(updated.user.username, session.user.username)
  assert.throws(() => sessionWithProfile(session, { id: 'bob', ...fields }))
})

test('failed and malformed responses do not mutate the previous profile', async () => {
  const original = JSON.stringify(session)
  for (const response of [
    new Response(JSON.stringify({ message: ['Invalid name', 'Try again'] }), { status: 400 }),
    new Response('offline', { status: 500 }),
    new Response('{}', { status: 200 }),
    new Response(JSON.stringify({ id: 'alice', ...fields, gamingProfiles: null }), { status: 200 }),
  ]) {
    await assert.rejects(updateUserProfile(fields, session.token, async () => response))
  }
  assert.equal(JSON.stringify(session), original)
})

test('profile retrieval uses the authenticated owner endpoint', async () => {
  const account = await getCurrentUser(session.token, async (url, options) => {
    assert.ok(url.endsWith('/users/me'))
    assert.equal(options.headers.Authorization, 'Bearer original-token')
    return new Response(JSON.stringify(session.user))
  })
  assert.deepEqual(account, session.user)
  await assert.rejects(getCurrentUser(session.token, async () => new Response('{}')))
})
