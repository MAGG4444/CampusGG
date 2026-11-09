import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getSteamLinkUrl,
  getSteamStats,
  unlinkSteamAccount,
} from '../src/api/steam.js'
import {
  formatPlaytime,
  STEAM_LINK_ERRORS,
  steamLinkFeedback,
  steamSyncedLabel,
} from '../src/utils/steam.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('steam link feedback maps success and stable error reasons', () => {
  assert.deepEqual(steamLinkFeedback(new URLSearchParams('steam=linked')), {
    type: 'success',
    message: 'Steam account linked. Your playtime will sync automatically.',
  })

  const alreadyLinked = steamLinkFeedback('steam=error&reason=already_linked')
  assert.equal(alreadyLinked.type, 'error')
  assert.equal(alreadyLinked.message, STEAM_LINK_ERRORS.already_linked)

  const cancelled = steamLinkFeedback(
    new URLSearchParams('steam=error&reason=cancelled'),
  )
  assert.match(cancelled.message, /cancelled/i)

  assert.equal(
    steamLinkFeedback('steam=error&reason=unknown_reason').message,
    STEAM_LINK_ERRORS.unexpected,
  )
  assert.equal(steamLinkFeedback('steam=error').message, STEAM_LINK_ERRORS.unexpected)
  assert.equal(steamLinkFeedback(''), null)
  assert.equal(steamLinkFeedback(new URLSearchParams('foo=bar')), null)
})

test('playtime formatting handles minutes, hours, and zero', () => {
  assert.equal(formatPlaytime(0, 0), 'No playtime')
  assert.equal(formatPlaytime(undefined, undefined), 'No playtime')
  assert.equal(formatPlaytime(30, 0.5), '30 min')
  assert.equal(formatPlaytime(59, 0.98), '59 min')
  assert.equal(formatPlaytime(60, 1), '1 hrs')
  assert.equal(formatPlaytime(90, 1.5), '1.5 hrs')
  assert.equal(formatPlaytime(7260, 121), '121 hrs')
  assert.equal(formatPlaytime(120), '2 hrs')
})

test('sync label degrades gracefully for missing dates', () => {
  assert.equal(steamSyncedLabel(undefined), 'Synced with Steam.')
  assert.equal(steamSyncedLabel('not-a-date'), 'Synced with Steam.')
  assert.match(
    steamSyncedLabel('2026-01-02T03:04:05.000Z'),
    /^Last synced /,
  )
})

test('link API requests an authenticated URL', async () => {
  let captured

  const url = await getSteamLinkUrl('secret-token', async (input, options) => {
    captured = { input, options }
    return jsonResponse({
      url: 'https://steamcommunity.com/openid/login?openid.mode=checkid_setup',
    })
  })

  assert.equal(captured.input, 'http://localhost:3000/steam/link')
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-token')
  assert.match(url, /^https:\/\/steamcommunity\.com\/openid\/login/)

  await assert.rejects(getSteamLinkUrl(''), /sign in/i)
  await assert.rejects(
    getSteamLinkUrl('token', async () => jsonResponse({})),
    /Invalid Steam link response/,
  )
})

test('stats API builds top/refresh query parameters', async () => {
  let requested

  const result = await getSteamStats('secret-token', {
    top: 5,
    refresh: true,
    fetchImpl: async (input, options) => {
      requested = { input, options }
      return jsonResponse({ status: 'OK', topGames: [] })
    },
  })

  const url = new URL(requested.input)
  assert.equal(url.pathname, '/steam/stats')
  assert.equal(url.searchParams.get('top'), '5')
  assert.equal(url.searchParams.get('refresh'), 'true')
  assert.equal(requested.options.headers.Authorization, 'Bearer secret-token')
  assert.deepEqual(result, { status: 'OK', topGames: [] })
})

test('stats API defaults to ten games without forcing a refresh', async () => {
  let requested

  await getSteamStats('token', {
    fetchImpl: async (input) => {
      requested = input
      return jsonResponse({ status: 'NOT_LINKED' })
    },
  })

  const url = new URL(requested)
  assert.equal(url.searchParams.get('top'), '10')
  assert.equal(url.searchParams.get('refresh'), null)

  await assert.rejects(getSteamStats(''), /sign in/i)
  await assert.rejects(
    getSteamStats('token', {
      fetchImpl: async () => jsonResponse({}),
    }),
    /Invalid Steam stats response/,
  )
})

test('unlink API sends DELETE and validates the response', async () => {
  let captured

  const result = await unlinkSteamAccount('secret-token', async (input, options) => {
    captured = { input, options }
    return jsonResponse({ status: 'NOT_LINKED' })
  })

  assert.equal(captured.input, 'http://localhost:3000/steam/link')
  assert.equal(captured.options.method, 'DELETE')
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-token')
  assert.deepEqual(result, { status: 'NOT_LINKED' })

  await assert.rejects(unlinkSteamAccount(''), /sign in/i)
  await assert.rejects(
    unlinkSteamAccount('token', async () => jsonResponse({ status: 'OK' })),
    /Invalid Steam unlink response/,
  )
})

test('API errors surface backend messages', async () => {
  await assert.rejects(
    getSteamStats('token', {
      fetchImpl: async () => jsonResponse({ message: 'Steam is down' }, 503),
    }),
    /Steam is down/,
  )
})
