import '../src/index.css'
import '../src/App.css'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AuthContext } from '../src/context/authContext.js'
import MyContent from '../src/pages/MyContent.jsx'
import Profile from '../src/pages/Profile.jsx'
import Drafts from '../src/pages/Drafts.jsx'
import CreatePost from '../src/pages/CreatePost.jsx'
import CreateLobby from '../src/pages/CreateLobby.jsx'
import { NotificationContext } from '../src/components/notifications/notificationContext.js'
import { saveDraft, getDraft, deleteDraft, draftDefaults } from '../src/utils/draftStorage.js'

window.IS_REACT_ACT_ENVIRONMENT = true
const root = createRoot(document.getElementById('root'))
const results = []
const user = { id: 'test-my-content-a', username: 'player', email: 'a@example.edu' }
let auth, router, requests, signouts
const createdDrafts = []
const notifications = { addNotification: () => {} }
const originalConfirm = window.confirm
function seed(type, title, userId = user.id) {
  const draft = saveDraft(userId, type, { ...draftDefaults[type], [type === 'post' ? 'title' : 'lobbyName']: title })
  createdDrafts.push(draft)
  return draft
}
const check = (value, message) => { if (!value) throw new Error(message) }
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
async function render() {
  await act(async () => { root.render(<NotificationContext.Provider value={notifications}><AuthContext.Provider value={auth}><RouterProvider router={router} /></AuthContext.Provider></NotificationContext.Provider>); await flush() })
}
async function setup(path = '/my-content?tab=posts') {
  if (router) { await act(async () => root.render(null)); router.dispose() }
  signouts = 0
  auth = { user, token: 'token-a', isAuthenticated: true, signOut: () => { signouts++ } }
  requests = []
  window.fetch = (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }))
  router = createMemoryRouter([
    { path: '/my-content', element: <MyContent /> }, { path: '/profile', element: <Profile /> },
    { path: '/drafts', element: <Drafts /> }, { path: '/signin', element: <p>Sign in</p> },
    { path: '/', element: <p>Home</p> },
    { path: '/create-post', element: <CreatePost /> },
    { path: '/create-lobby', element: <CreateLobby /> },
    { path: '/forum', element: <p>Forum feed</p> },
    { path: '/lobby', element: <p>Lobby feed</p> },
    { path: '/forum/:id', element: <p>Post detail</p> },
    { path: '/lobby/:id', element: <p>Lobby detail</p> },
  ], { initialEntries: [path] })
  await render()
}
async function respond(index, items = [], total = items.length, status = 200) {
  await act(async () => { requests[index].resolve(Response.json(status === 200 ? { items, total, page: 1, limit: 10 } : { message: 'Temporary failure' }, { status })); await flush() })
}
async function click(selector) {
  const target = document.querySelector(selector)
  check(target, `Missing element: ${selector}`)
  await act(async () => { if (target instanceof SVGElement) target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    else target.click()
    await flush() })
}
const item = (title = 'My post') => ({ id: 'p1', title, preview: 'Preview text', createdAt: '2026-01-01T00:00:00Z' })
async function run(name, action) {
  await action()
  results.push(`PASS ${name}`)
  document.getElementById('results').textContent = results.join('\n')
}
try {
  await run('unauthenticated route redirects to sign in', async () => {
    await setup(); auth = { ...auth, user: null, token: null, isAuthenticated: false }; await render()
    check(router.state.location.pathname === '/signin', 'Protected route failed')
    check(requests[0].options.signal.aborted, 'Request not cancelled on signout')
  })
  await run('loading, error, retry, empty posts, empty hosted lobbies', async () => {
    await setup(); check(document.body.textContent.includes('Loading your posts'), 'Missing loading state')
    await respond(0, [], 0, 503); check(document.querySelector('[role=alert]'), 'Missing error')
    await click('.my-content-state button'); check(requests.length === 2, 'Retry did not fetch')
    await respond(1); check(document.body.textContent.includes('No published posts yet'), 'Missing empty posts')
    await click('#my-content-tab-lobbies'); await respond(2)
    check(document.body.textContent.includes('No hosted lobbies yet'), 'Missing empty lobbies')
  })
  await run('URL tab, keyboard switching, obsolete response ignored', async () => {
    await setup('/my-content?tab=lobbies&page=2'); check(requests[0].url.includes('/lobbies/me?page=2'), 'URL selection lost')
    await act(async () => { document.querySelector('#my-content-tab-lobbies').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await flush() })
    check(router.state.location.search === '?tab=posts', 'Keyboard switch failed')
    check(requests[0].options.signal.aborted, 'Obsolete tab request not cancelled')
    await respond(1, [item('Current post')]); await respond(0, [item('Stale lobby')])
    check(!document.body.textContent.includes('Stale lobby'), 'Stale result rendered')
    await click('#my-content-tab-drafts')
    await act(async () => { await router.navigate(-1); await flush() })
    check(document.querySelector('[aria-label="Refresh content"]').disabled, 'History return reused completed loading state')
    await respond(2)
  })
  await run('account switch cancels results and stale 401 cannot sign out new account', async () => {
    await setup(); auth = { ...auth, user: { ...user, id: 'account-b' }, token: 'token-b' }; await render()
    check(requests[0].options.signal.aborted, 'Old account request not aborted')
    check(requests[1].options.headers.Authorization === 'Bearer token-b', 'New account token missing')
    await respond(1, [item('Account B post')]); await respond(0, [], 0, 401)
    check(signouts === 0 && document.body.textContent.includes('Account B post'), 'Stale 401 affected B')
    await click('[aria-label="Refresh content"]'); await respond(2, [], 0, 401)
    check(signouts === 1, 'Current expired session not signed out')
  })
  for (const [tab, route] of [['posts', '/forum/p1'], ['lobbies', '/lobby/p1']]) {
    await run(`${tab}: one full-card link opens from title, preview, date, arrow and padding`, async () => {
      for (const target of ['h2', '.my-content-preview', '.my-content-date', 'svg', '']) {
        await setup(`/my-content?tab=${tab}`); await respond(0, [item()])
        const card = document.querySelector('.my-content-card')
        check(card?.tagName === 'A', 'Card must be a native link')
        check(!card.querySelector('a, button, input, [tabindex]'), 'Nested interactive content')
        check(card.tabIndex === 0, 'Card is not keyboard focusable')
        await click(`.my-content-card ${target}`.trim())
        check(router.state.location.pathname === route, `Wrong destination from ${target || 'padding'}`)
        check(router.state.location.state.from === `/my-content?tab=${tab}&page=1`, 'Return context lost')
      }
    })
  }
  await run('pagination, detail link, revisit and deletion refresh', async () => {
    await setup(); await respond(0, [item()], 11)
    await click('.my-content-pagination button:last-child')
    check(requests[1].url.includes('page=2'), 'Next page failed')
    await respond(1, [item('Last post')], 11)
    await click('.my-content-list a')
    check(router.state.location.pathname === '/forum/p1', 'Wrong detail route')
    check(router.state.location.state.from === '/my-content?tab=posts&page=2', 'Return context lost')
    await act(async () => { await router.navigate(-1); await flush() })
    check(requests.length === 3, 'Revisit did not fetch fresh content')
    await respond(2, [], 10)
    check(!document.body.textContent.includes('Last post'), 'Deleted post remains')
    await click('.my-content-state button'); await respond(3)
    check(router.state.location.search.includes('page=1'), 'First page recovery failed')
  })
  await run('one Profile card, all tabs, legacy redirect and Sign Out', async () => {
    await setup('/profile')
    for (const title of ['Account', 'Gaming', 'About Me', 'My Content', 'Sign Out']) check(document.body.textContent.includes(title), `Missing ${title}`)
    check(document.querySelectorAll('.profile-content').length === 1, 'Expected one card')
    await click('a[href="/my-content"]'); await respond(0)
    await click('#my-content-tab-lobbies'); await respond(1)
    await click('#my-content-tab-drafts')
    check(requests.length === 2, 'Draft tab fetched the backend')
    await act(async () => { await router.navigate('/drafts'); await flush() })
    check(router.state.location.pathname === '/my-content' && router.state.location.search === '?tab=drafts', 'Legacy redirect failed')
    await click('a[aria-label="Back to Profile"]')
    await click('.profile-signout'); check(signouts === 1 && router.state.location.pathname === '/', 'Sign Out broken')
  })
  await run('creation actions share the toolbar and preserve each originating tab', async () => {
    for (const [tab, type] of [['posts', 'post'], ['lobbies', 'lobby'], ['drafts', 'post'], ['drafts', 'lobby']]) {
      await setup(`/my-content?tab=${tab}&page=2`)
      if (tab !== 'drafts') await respond(0)
      check(document.querySelector('.my-content-actions [aria-label="Refresh content"]'), 'Refresh moved out of actions')
      check(!document.querySelector('.drafts-page nav[aria-label="Create content"]'), 'Original draft action row remains')
      if (tab === 'drafts') await click('.my-content-create-dropdown > button')
      await click(`.my-content-actions a[href="/create-${type}"]`)
      check(router.state.location.pathname === `/create-${type}`, 'Wrong creation destination')
      await click('form > .create-actions > .footer-save')
      const id = new URLSearchParams(router.state.location.search).get('draftId')
      check(id, 'Draft save lost ID')
      createdDrafts.push({ userId: user.id, id })
      await click(tab === 'drafts' ? 'button[aria-label="Back to My Drafts"]' : 'button[aria-label="Back to My Content"]')
      check(router.state.location.pathname === '/my-content', 'Did not return to My Content')
      check(router.state.location.search === (tab === 'drafts' ? '?tab=drafts' : `?tab=${tab}&page=2`), 'Originating tab/page lost')
    }
  })
  await run('New dropdown supports mouse, arrows, Escape, focus exit and outside dismissal', async () => {
    await setup('/my-content?tab=drafts')
    const trigger = () => document.querySelector('.my-content-create-dropdown > button')
    const expanded = () => trigger().getAttribute('aria-expanded') === 'true'
    const key = async value => act(async () => {
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
      await flush()
    })
    await click('.my-content-create-dropdown > button')
    check(expanded() && document.activeElement.textContent === 'New Lobby', 'Open/focus failed')
    await key('ArrowDown'); check(document.activeElement.textContent === 'New Post', 'Arrow navigation failed')
    await key('ArrowDown'); check(document.activeElement.textContent === 'New Lobby', 'Arrow wrapping failed')
    await key('End'); check(document.activeElement.textContent === 'New Post', 'End failed')
    await key('Home'); check(document.activeElement.textContent === 'New Lobby', 'Home failed')
    await key('Escape'); check(!expanded() && document.activeElement === trigger(), 'Escape did not restore trigger focus')
    await key('ArrowDown'); check(expanded(), 'Keyboard opening failed')
    await act(async () => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await flush() })
    check(!expanded(), 'Outside click did not dismiss')
    await click('.my-content-create-dropdown > button')
    await act(async () => { document.querySelector('[aria-label="Refresh content"]').focus(); await flush() })
    check(!expanded(), 'Focus exit did not dismiss')
  })
  await run('refresh icon disables and spins until request settles; drafts stay intact', async () => {
    const draft = seed('post', 'Keep this draft')
    await setup()
    const refresh = () => document.querySelector('[aria-label="Refresh content"]')
    check(refresh().disabled && refresh().querySelector('.my-content-spin'), 'Missing initial loading state')
    await respond(0)
    check(!refresh().disabled, 'Refresh stayed disabled')
    await click('[aria-label="Refresh content"]')
    check(refresh().disabled && refresh().getAttribute('aria-busy') === 'true', 'Refresh not busy')
    await click('[aria-label="Refresh content"]')
    check(requests.length === 2, 'Disabled refresh submitted another request')
    await respond(1, [], 0, 503)
    check(!refresh().disabled && !refresh().querySelector('.my-content-spin'), 'Error did not end refresh')
    check(getDraft(user.id, draft.id, 'post').formData.title === 'Keep this draft', 'Refresh changed draft')
  })
  await run('draft filtering, refresh, deletion and account isolation reuse storage', async () => {
    const post = seed('post', 'Draft post')
    seed('lobby', 'Draft lobby')
    const other = seed('post', 'Other account draft', 'test-my-content-b')
    await setup('/my-content?tab=drafts')
    check(requests.length === 0, 'Drafts called backend')
    check(!document.body.textContent.includes('Other account draft'), 'Other account data leaked')
    await click('[aria-label="Filter drafts"] button:last-child')
    check(!document.querySelector('.drafts-list').textContent.includes('Draft lobby'), 'Draft filter failed')
    await click('[aria-label="Refresh content"]')
    check(document.querySelector('[aria-label="Filter drafts"] button:last-child').getAttribute('aria-pressed') === 'true', 'Refresh reset filter')
    window.confirm = () => true
    const row = [...document.querySelectorAll('.draft-row')].find(node => node.textContent.includes('Draft post'))
    await act(async () => { row.querySelector('button').click(); await flush() })
    check(!document.querySelector(`a[href*="${post.id}"]`), 'Deleted draft remains')
    check(getDraft(other.userId, other.id, 'post').formData.title === 'Other account draft', 'Deletion affected other account')
    auth = { ...auth, user: { ...user, id: other.userId }, token: 'other-token' }; await render()
    check(document.querySelectorAll('.draft-row').length === 1, 'Account switch retained old drafts')
    check(document.body.textContent.includes('Other account draft'), 'New account drafts not loaded')
  })
  for (const type of ['post', 'lobby']) {
    await run(`${type} draft restores ID, warns before leaving, autosaves only itself, and returns to Drafts`, async () => {
      const draft = seed(type, `${type} to edit`)
      const untouched = seed(type, 'Do not overwrite')
      await setup('/my-content?tab=drafts')
      await click(`a[href="/create-${type}?draftId=${draft.id}"]`)
      const selector = type === 'post' ? '#post-title' : '#lobby-name'
      check(document.querySelector(selector).value === `${type} to edit`, 'Draft not restored')
      check(router.state.location.search === `?draftId=${draft.id}`, 'Draft ID lost')
      await act(async () => {
        const field = document.querySelector(selector)
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'Edited draft')
        field.dispatchEvent(new Event('input', { bubbles: true }))
        await flush()
      })
      await click('button[aria-label="Back to My Drafts"]')
      check(document.querySelector('dialog').open, 'Unsaved warning missing')
      await click('dialog button:first-child')
      check(router.state.location.search.includes(draft.id), 'Stay changed draft ID')
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)) })
      check(getDraft(user.id, draft.id, type).formData[type === 'post' ? 'title' : 'lobbyName'] === 'Edited draft', 'Autosave failed')
      check(getDraft(user.id, untouched.id, type).formData[type === 'post' ? 'title' : 'lobbyName'] === 'Do not overwrite', 'Wrong draft overwritten')
      await click('button[aria-label="Back to My Drafts"]')
      check(router.state.location.search === '?tab=drafts', 'Back lost Drafts tab')
      // A direct editor URL (without navigation state) still knows this is a draft.
      await setup(`/create-${type}?draftId=${draft.id}`)
      await click('button[aria-label="Back to My Drafts"]')
      check(router.state.location.search === '?tab=drafts', 'Direct draft URL back failed')
    })
  }
  await run('Drafts omits the redundant description and retains filters and empty states', async () => {
    await setup('/my-content?tab=drafts')
    check(!document.body.textContent.includes('Pick up where you left off.'), 'Redundant description remains')
    check(document.querySelector('[aria-label="Filter drafts"]'), 'Draft filters missing')
  })
  for (const type of ['post', 'lobby']) {
    await run(`${type} footer keeps Drafts separate, warns before navigating, and preserves Save/Publish/Delete`, async () => {
      const draft = seed(type, 'Footer draft')
      await setup(`/create-${type}?draftId=${draft.id}`)
      const link = document.querySelector('.editor-drafts-link')
      check(link?.getAttribute('href') === '/my-content?tab=drafts' && link.querySelector('svg'), 'Outlined Drafts link/icon missing')
      check(!document.body.textContent.includes('Start a new'), 'Redundant editor link remains')
      check(getComputedStyle(link).textDecorationLine === 'none', 'Drafts action is underlined')
      await act(async () => {
        const field = document.querySelector(type === 'post' ? '#post-title' : '#lobby-name')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'Changed footer draft')
        field.dispatchEvent(new Event('input', { bubbles: true })); await flush()
      })
      await click('.editor-drafts-link')
      check(document.querySelector('dialog').open, 'Drafts navigation bypassed warning')
      await click('dialog button:first-child')
      await click('form > .create-actions > .footer-save')
      check(document.querySelector('.create-status').textContent.includes('in this browser'), 'Local save feedback missing')
      check(getDraft(user.id, draft.id, type).formData[type === 'post' ? 'title' : 'lobbyName'] === 'Changed footer draft', 'Manual save failed')
      await click('.editor-drafts-link')
      check(router.state.location.search === '?tab=drafts', 'Drafts action went to wrong tab')
      check(getDraft(user.id, draft.id, type), 'Navigation removed draft')
      await setup(`/create-${type}?draftId=${draft.id}`)
      window.confirm = () => true
      await click('form > .create-actions > .footer-delete')
      let removed = false
      try { getDraft(user.id, draft.id, type) } catch { removed = true }
      check(removed, 'Delete did not remove selected draft')
      const published = seed(type, 'Ready to publish')
      saveDraft(user.id, type, { ...published.formData, [type === 'post' ? 'content' : 'details']: 'Valid publish content' }, published.id)
      await setup(`/create-${type}?draftId=${published.id}`)
      await click('form > .create-actions > .footer-publish')
      check(requests.length === 1 && requests[0].options.method === 'POST', 'Publish did not submit')
      await act(async () => { requests[0].resolve(Response.json({ id: 'published' }, { status: 201 })); await flush() })
      check(router.state.location.pathname === (type === 'post' ? '/forum/published' : '/lobby'), 'Publish destination changed')
      removed = false
      try { getDraft(user.id, published.id, type) } catch { removed = true }
      check(removed, 'Successful publish did not clean up its draft')
    })
  }
  await run('new editors preserve Lobby/Forum destinations', async () => {
    for (const [type, path, label] of [['post', '/forum', 'Forum'], ['lobby', '/lobby', 'Lobby']]) {
      await setup(`/create-${type}`)
      await click('form > .create-actions > .footer-save')
      const id = new URLSearchParams(router.state.location.search).get('draftId')
      check(id, 'Saving new draft did not preserve ID')
      createdDrafts.push({ userId: user.id, id })
      await click(`button[aria-label="Back to ${label}"]`)
      check(router.state.location.pathname === path, 'Feed destination changed')
    }
  })
  document.getElementById('results').dataset.status = 'passed'
} catch (error) {
  results.push(`FAIL ${error.stack}`)
  document.getElementById('results').textContent = results.join('\n')
  document.getElementById('results').dataset.status = 'failed'
} finally {
  if (!['posts', 'lobbies', 'drafts'].includes(new URLSearchParams(window.location.search).get('preview'))) {
    await act(async () => root.unmount())
    router?.dispose()
  }
  window.confirm = originalConfirm
  for (const draft of createdDrafts) deleteDraft(draft.userId, draft.id)
}

// Keep a real card rendered for manual Tab/Enter, hover and viewport checks.
const previewTab = new URLSearchParams(window.location.search).get('preview')
if (document.getElementById('results').dataset.status === 'passed' && ['posts', 'lobbies', 'drafts'].includes(previewTab)) {
  await setup(`/my-content?tab=${previewTab}`)
  if (previewTab !== 'drafts') await respond(0, [item(previewTab === 'posts' ? 'Example post' : 'Example lobby')])
  document.getElementById('results').hidden = true
}
