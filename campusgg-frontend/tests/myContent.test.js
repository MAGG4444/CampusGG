import test from 'node:test'
import assert from 'node:assert/strict'
import { getMyForumPosts } from '../src/api/forum.js'
import { getMyLobbies } from '../src/api/lobbies.js'
import { myContentLocation, myContentReturnTo, draftEditorReturnTo } from '../src/utils/myContentNavigation.js'

for (const [name, fetchPage, path] of [
  ['posts', getMyForumPosts, '/forum/posts/me'],
  ['lobbies', getMyLobbies, '/lobbies/me'],
]) {
  test(`${name}: passes JWT, pagination and cancellation; returns empty results`, async t => {
    const signal = new AbortController().signal
    const result = { items: [], total: 0, page: 2, limit: 10 }
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, `http://localhost:3000${path}?page=2&limit=10`)
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      assert.equal(options.signal, signal)
      return Response.json(result)
    })
    assert.deepEqual(await fetchPage('test-token', { page: 2, signal }), result)
  })
  test(`${name}: surfaces expiration and server errors for retry`, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Expired' }, { status: 401 }))
    await assert.rejects(fetchPage('expired'), { status: 401, message: 'Expired' })
    globalThis.fetch = async () => new Response('Unavailable', { status: 503 })
    await assert.rejects(fetchPage('token'), { status: 503 })
  })
  test(`${name}: each revisit fetches fresh results after deletion`, async t => {
    let items = [{ id: 'post' }]
    t.mock.method(globalThis, 'fetch', async () => Response.json({ items, total: items.length }))
    assert.equal((await fetchPage('token')).items.length, 1)
    items = []
    assert.equal((await fetchPage('token')).items.length, 0)
  })
}

test('tab and page are URL-backed with safe defaults', () => {
  assert.deepEqual(myContentLocation('?tab=lobbies&page=2'), { tab: 'lobbies', page: 2 })
  assert.deepEqual(myContentLocation('?tab=unknown&page=-1'), { tab: 'posts', page: 1 })
  assert.equal(myContentLocation('?page=1.5').page, 1)
  assert.equal(myContentLocation('?page=9999999999999999').page, 1)
})

test('detail return links accept only the local My Content route', () => {
  assert.equal(myContentReturnTo({ from: '/my-content?tab=posts&page=2' }, '/forum'), '/my-content?tab=posts&page=2')
  for (const from of ['https://evil.example', '//evil.example', '/my-content-other', '/forum', null]) {
    assert.equal(myContentReturnTo({ from }, '/forum'), '/forum')
  }
  assert.equal(myContentReturnTo(null, '/lobby'), '/lobby')
})


test('draft URLs and editor origins return to the consolidated Drafts tab', () => {
  assert.deepEqual(myContentLocation('?tab=drafts'), { tab: 'drafts', page: 1 })
  for (const from of ['/drafts', '/my-content?tab=drafts']) {
    assert.equal(draftEditorReturnTo({ state: { from }, search: '?draftId=one' }, '/forum'), '/my-content?tab=drafts')
  }
  assert.equal(draftEditorReturnTo({ search: '?draftId=one' }, '/lobby'), '/my-content?tab=drafts')
  assert.equal(draftEditorReturnTo({ search: '' }, '/forum'), '/forum')
  assert.equal(draftEditorReturnTo({ state: { from: '/lobby' }, search: '' }, '/lobby'), '/lobby')
})


test('creation returns to the originating My Content tab and page', () => {
  for (const tab of ['posts', 'lobbies', 'drafts']) {
    const from = `/my-content?tab=${tab}&page=2`
    const expected = tab === 'drafts' ? '/my-content?tab=drafts' : from
    assert.equal(draftEditorReturnTo({ state: { from }, search: '' }, '/forum'), expected)
    assert.equal(draftEditorReturnTo({ state: { from }, search: '?draftId=saved' }, '/lobby'), expected)
  }
  assert.equal(draftEditorReturnTo({ state: { from: 'https://example.com' }, search: '' }, '/forum'), '/forum')
})
