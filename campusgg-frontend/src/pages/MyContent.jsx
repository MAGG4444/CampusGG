import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { getMyForumPosts } from '../api/forum.js'
import { getMyLobbies } from '../api/lobbies.js'
import { myContentLocation } from '../utils/myContentNavigation.js'
import DraftList from '../components/DraftList.jsx'
import ContentCreateAction from '../components/ContentCreateAction.jsx'
import './Profile.css'
import './MyContent.css'

const PAGE_SIZE = 10
const TABS = [['posts', 'My Posts'], ['lobbies', 'My Lobbies'], ['drafts', 'My Drafts']]

function ContentList({ tab, page, token, signOut, changePage, refresh, returnTo, onSettled }) {
  const [result, setResult] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    const controller = new AbortController()
    const fetchPage = tab === 'posts' ? getMyForumPosts : getMyLobbies
    fetchPage(token, { page, limit: PAGE_SIZE, signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      setResult({ loading: false, error: '', data })
    }).catch(error => {
      // Unmounted/account-switched requests cannot update state or sign out a new account.
      if (controller.signal.aborted) return
      if (error.status === 401) {
        signOut()
        return
      }
      setResult({ loading: false, error: error.message || 'Unable to load your content.', data: null })
    }).finally(() => {
      if (!controller.signal.aborted) onSettled()
    })
    return () => controller.abort()
  }, [tab, page, token, signOut, onSettled])

  if (result.loading) return <p role="status">Loading your {tab}…</p>
  if (result.error) return (
    <div className="my-content-state">
      <p role="alert">{result.error}</p>
      <button type="button" className="my-content-button" onClick={refresh}>Retry</button>
    </div>
  )

  const { items, total } = result.data
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <>
      {items.length ? (
        <ul className="my-content-list">
          {items.map(item => (
            <li key={item.id}>
              <Link className="profile-section my-content-card"
                to={`/${tab === 'posts' ? 'forum' : 'lobby'}/${encodeURIComponent(item.id)}`}
                state={{ from: returnTo }} aria-labelledby={`content-title-${item.id}`}>
                <h2 id={`content-title-${item.id}`}>{item.title}<ArrowRight size={20} aria-hidden="true" /></h2>
                <p className="my-content-date">Created <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time></p>
                <p className="my-content-preview">{item.preview || 'No description provided.'}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="my-content-state" role="status">
          <h2>{total > 0 ? 'No items on this page' : tab === 'posts' ? 'No published posts yet' : 'No hosted lobbies yet'}</h2>
          <p>{total > 0 ? 'Your content may have changed. Return to the first page or refresh.' : tab === 'posts' ? 'Posts you publish in the Forum will appear here.' : 'Lobbies you create will appear here. Lobbies you only join are not included.'}</p>
          {page > 1 && <button className="my-content-button" type="button" onClick={() => changePage(1)}>First page</button>}
        </div>
      )}
      {(totalPages > 1 || page > 1) && (
        <nav className="my-content-pagination" aria-label="Content pagination">
          <button className="my-content-button" type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
          <span>Page {page} · {total} {tab}</span>
          <button className="my-content-button" type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button>
        </nav>
      )}
    </>
  )
}

function MyContentPage({ user, token, signOut }) {
  const location = useLocation()
  const [, setParams] = useSearchParams()
  const { tab, page } = myContentLocation(location.search)
  const [revision, setRevision] = useState(0)
  const returnTo = `/my-content?tab=${tab}&page=${page}`
  const changePage = value => setParams({ tab, page: String(value) })
  const draftList = useRef(null)
  const requestKey = `${tab}:${page}:${revision}:${location.key}`
  const [completedRequest, setCompletedRequest] = useState(null)
  const refreshing = tab !== 'drafts' && completedRequest !== requestKey
  const onSettled = useCallback(() => setCompletedRequest(requestKey), [requestKey])
  const refresh = () => {
    if (tab === 'drafts') draftList.current?.refresh()
    else setRevision(value => value + 1)
  }

  function switchTabWithKeyboard(event) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const index = TABS.findIndex(([value]) => value === tab)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    const next = TABS[nextIndex][0]
    setParams({ tab: next })
    document.getElementById(`my-content-tab-${next}`)?.focus()
  }

  return (
    <div className="profile-page page-enter">
      <section className="profile-card my-content-page" aria-labelledby="my-content-title">
        <Link className="my-content-back" to="/profile" aria-label="Back to Profile"><ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" /></Link>
        <header className="my-content-heading">
          <p className="profile-eyebrow">Your campus activity</p>
          <h1 id="my-content-title">My Content</h1>
          <p>Manage your posts, lobbies, and drafts.</p>
        </header>
        <div className="my-content-toolbar">
          <div className="my-content-tabs" role="tablist" aria-label="My Content">
            {TABS.map(([value, label]) => (
              <Link key={value} id={`my-content-tab-${value}`} role="tab" aria-selected={tab === value}
                aria-controls="my-content-panel" tabIndex={tab === value ? 0 : -1}
                onKeyDown={switchTabWithKeyboard} to={`/my-content?tab=${value}`}>{label}</Link>
            ))}
          </div>
          <div className="my-content-actions">
            <ContentCreateAction tab={tab} returnTo={returnTo} />
            <button className="my-content-button my-content-refresh" type="button" onClick={refresh}
              aria-label="Refresh content" title="Refresh content" disabled={refreshing} aria-busy={refreshing}>
              <RefreshCw size={20} className={refreshing ? 'my-content-spin' : undefined} aria-hidden="true" />
            </button>
          </div>
        </div>
        <section id="my-content-panel" role="tabpanel" aria-labelledby={`my-content-tab-${tab}`} tabIndex={0}>
          {tab === 'drafts' ? <DraftList key={user.id} userId={user.id} refreshRef={draftList} /> : (
            <ContentList key={requestKey}
              tab={tab} page={page} token={token} signOut={signOut} changePage={changePage}
              refresh={refresh} returnTo={returnTo} onSettled={onSettled} />
          )}
        </section>
      </section>
    </div>
  )
}

export default function MyContent() {
  const location = useLocation()
  const { user, token, isAuthenticated, signOut } = useAuth()
  if (!isAuthenticated || !token) return <Navigate to="/signin" replace />
  return <MyContentPage key={`${user.id}:${token}:${location.key}`} user={user} token={token} signOut={signOut} />
}
