import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteDraft, draftDefaults, getDraft, listDrafts, saveDraft } from '../src/utils/draftStorage.js'

function memoryStorage() {
  const data = new Map()
  return {
    get length() { return data.size },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
}

test('multiple drafts of both types survive a fresh read and updates preserve identity', () => {
  const storage = memoryStorage()
  const first = saveDraft('alice', 'post', { ...draftDefaults.post, title: 'First' }, null, storage)
  const second = saveDraft('alice', 'post', { ...draftDefaults.post, title: 'Second' }, null, storage)
  const lobby = saveDraft('alice', 'lobby', draftDefaults.lobby, null, storage)
  assert.equal(new Set([first.id, second.id, lobby.id]).size, 3)
  const edited = saveDraft('alice', 'post', { ...first.formData, content: 'Edited' }, first.id, storage)
  assert.equal(edited.id, first.id)
  assert.equal(edited.createdAt, first.createdAt)
  assert.ok(edited.updatedAt >= first.updatedAt)
  assert.equal(getDraft('alice', first.id, 'post', storage).formData.content, 'Edited')
  assert.equal(getDraft('alice', second.id, 'post', storage).formData.title, 'Second')
  assert.equal(listDrafts('alice', storage).drafts.length, 3)
})

test('user isolation covers listing, reading, updating, and deleting', () => {
  const storage = memoryStorage()
  const alice = saveDraft('alice', 'post', draftDefaults.post, null, storage)
  saveDraft('bob', 'lobby', draftDefaults.lobby, null, storage)
  assert.equal(listDrafts('bob', storage).drafts.length, 1)
  assert.throws(() => getDraft('bob', alice.id, 'post', storage))
  assert.throws(() => saveDraft('bob', 'post', draftDefaults.post, alice.id, storage))
  deleteDraft('bob', alice.id, storage)
  assert.equal(getDraft('alice', alice.id, 'post', storage).id, alice.id)
  assert.throws(() => saveDraft('', 'post', draftDefaults.post, null, storage))
})

test('deletion removes only the selected draft and deleted IDs cannot be resurrected', () => {
  const storage = memoryStorage()
  const first = saveDraft('alice', 'post', draftDefaults.post, null, storage)
  const second = saveDraft('alice', 'post', draftDefaults.post, null, storage)
  deleteDraft('alice', first.id, storage)
  assert.deepEqual(listDrafts('alice', storage).drafts.map((draft) => draft.id), [second.id])
  assert.throws(() => saveDraft('alice', 'post', draftDefaults.post, first.id, storage))
  deleteDraft('alice', first.id, storage) // Idempotent if another tab already removed it.
})

test('invalid JSON, wrong ownership, invalid metadata and form shapes are skipped safely', () => {
  const storage = memoryStorage()
  const valid = saveDraft('alice', 'post', draftDefaults.post, null, storage)
  const invalidRecords = [
    '{', 'null', '[]',
    JSON.stringify({ ...valid, userId: 'bob' }),
    JSON.stringify({ ...valid, createdAt: 'yesterday' }),
    JSON.stringify({ ...valid, formData: { ...valid.formData, title: 42 } }),
    JSON.stringify({ ...valid, type: '__proto__' }),
    JSON.stringify({ ...valid, formData: { ...valid.formData, visibility: 'invalid' } }),
  ]
  for (const raw of invalidRecords) {
    const key = storage.key(0)
    storage.setItem(key, raw)
    assert.deepEqual(listDrafts('alice', storage), { drafts: [], invalidCount: 1 })
    assert.throws(() => getDraft('alice', valid.id, 'post', storage))
  }
  storage.setItem(storage.key(0), JSON.stringify(valid))
  storage.setItem('campusgg-draft:v1:alice:broken', '{')
  assert.equal(listDrafts('alice', storage).drafts.length, 1)
  assert.equal(listDrafts('alice', storage).invalidCount, 1)
})

test('unknown fields and credentials are not persisted or restored', () => {
  const storage = memoryStorage()
  const draft = saveDraft('alice', 'post', { ...draftDefaults.post, token: 'secret', password: 'secret' }, null, storage)
  assert.equal(storage.getItem(storage.key(0)).includes('secret'), false)
  storage.setItem(storage.key(0), JSON.stringify({ ...draft, token: 'secret', formData: { ...draft.formData, password: 'secret' } }))
  const restored = getDraft('alice', draft.id, 'post', storage)
  assert.equal('token' in restored, false)
  assert.equal('password' in restored.formData, false)
})

test('drafts sort by updated time and cannot be opened in the wrong editor', () => {
  const storage = memoryStorage()
  const first = saveDraft('alice', 'lobby', draftDefaults.lobby, null, storage)
  const second = saveDraft('alice', 'post', draftDefaults.post, null, storage)
  storage.setItem(storage.key(0), JSON.stringify({ ...first, createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' }))
  assert.deepEqual(listDrafts('alice', storage).drafts.map((draft) => draft.id), [second.id, first.id])
  assert.throws(() => getDraft('alice', first.id, 'post', storage))
})

test('storage failures propagate so callers cannot report a false success', () => {
  const storage = memoryStorage()
  const draft = saveDraft('alice', 'post', draftDefaults.post, null, storage)
  storage.setItem = () => { throw new Error('Quota exceeded') }
  assert.throws(() => saveDraft('alice', 'post', { ...draft.formData, title: 'Unsaved' }, draft.id, storage), /Quota/)
  assert.equal(getDraft('alice', draft.id, 'post', storage).formData.title, '')
  storage.removeItem = () => { throw new Error('Storage denied') }
  assert.throws(() => deleteDraft('alice', draft.id, storage), /Storage denied/)
  storage.getItem = () => { throw new Error('Storage denied') }
  assert.throws(() => listDrafts('alice', storage), /Storage denied/)
})

test('a stale autosave cannot overwrite a different type or a corrupted/replaced record', () => {
  const storage = memoryStorage()
  const post = saveDraft('alice', 'post', draftDefaults.post, null, storage)
  const key = storage.key(0)
  const replacements = [
    { ...post, type: 'lobby', formData: draftDefaults.lobby },
    { ...post, userId: 'bob' },
    { ...post, id: 'different-draft' },
  ]
  for (const replacement of replacements) {
    const raw = JSON.stringify(replacement)
    storage.setItem(key, raw)
    assert.throws(() => saveDraft('alice', 'post', post.formData, post.id, storage))
    assert.equal(storage.getItem(key), raw)
  }
})
