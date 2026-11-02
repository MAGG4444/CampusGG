import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { createMemoryRouter } from 'react-router-dom'
import { createDraftNavigationGuard } from '../src/utils/draftNavigation.js'

function setup() {
  const guard = createDraftNavigationGuard()
  const state = { dirty: true, published: false }
  const router = createMemoryRouter([{ path: '*', element: null }], {
    initialEntries: ['/drafts', '/create-post?draftId=first', '/create-post?draftId=second'],
    initialIndex: 1,
  })
  router.getBlocker('draft', (navigation) => guard.shouldBlock(state.dirty, state.published, navigation))
  return { guard, state, router, blocker: () => router.state.blockers.get('draft') }
}

test('Back and Forward can be cancelled without changing the selected draft', async () => {
  const { router, blocker } = setup()
  try {
    router.navigate(-1)
    assert.equal(blocker().state, 'blocked')
    assert.equal(router.state.location.search, '?draftId=first')
    blocker().reset()
    router.navigate(1)
    assert.equal(blocker().state, 'blocked')
    assert.equal(blocker().location.search, '?draftId=second')
    blocker().reset()
    assert.equal(router.state.location.search, '?draftId=first')
    router.navigate(1)
    blocker().proceed()
    await setImmediate()
    assert.equal(router.state.location.search, '?draftId=second')
  } finally {
    router.dispose()
  }
})

test('links and programmatic navigation share the same protection', async () => {
  const { router, blocker } = setup()
  try {
    await router.navigate('/drafts')
    assert.equal(blocker().state, 'blocked')
    blocker().reset()
    await router.navigate('/create-post')
    assert.equal(blocker().state, 'blocked')
    blocker().proceed()
    await setImmediate()
    assert.equal(router.state.location.search, '')
  } finally {
    router.dispose()
  }
})

test('saved forms and successful publishing do not block intended navigation', async () => {
  const { router, state, blocker } = setup()
  try {
    state.dirty = false
    await router.navigate('/drafts')
    assert.equal(router.state.location.pathname, '/drafts')
    assert.notEqual(blocker()?.state, 'blocked')
    state.dirty = true
    state.published = true
    await router.navigate('/forum/published-post')
    assert.equal(router.state.location.pathname, '/forum/published-post')
    assert.notEqual(blocker()?.state, 'blocked')
  } finally {
    router.dispose()
  }
})

test('save/delete URL replacements bypass only their own navigation, including on failure', async () => {
  const { router, guard, blocker } = setup()
  try {
    await guard.replaceDraftUrl(() => router.navigate('/create-post?draftId=saved', { replace: true }))
    assert.equal(router.state.location.search, '?draftId=saved')
    await guard.replaceDraftUrl(() => router.navigate('/create-post', { replace: true }))
    assert.equal(router.state.location.search, '')
    assert.throws(() => guard.replaceDraftUrl(() => { throw new Error('failed') }))
    await router.navigate('/drafts')
    assert.equal(blocker().state, 'blocked')
  } finally {
    router.dispose()
  }
})

test('same-editor hash navigation does not discard data or prompt', async () => {
  const { router, blocker } = setup()
  try {
    await router.navigate('/create-post?draftId=first#main-content')
    assert.equal(router.state.location.hash, '#main-content')
    assert.notEqual(blocker()?.state, 'blocked')
  } finally {
    router.dispose()
  }
})
