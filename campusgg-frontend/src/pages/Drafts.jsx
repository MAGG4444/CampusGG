import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { deleteDraft, listDrafts } from '../utils/draftStorage.js'
import './Profile.css'
import './CreateLobby.css'
import './Drafts.css'

function readDrafts(userId) {
  try {
    const { drafts, invalidCount } = listDrafts(userId)
    return { drafts, error: invalidCount ? 'Some damaged drafts could not be loaded. Your other drafts are available below.' : '' }
  } catch {
    return { drafts: [], error: 'Unable to load drafts from this browser. Check browser storage permissions and try again.' }
  }
}

function DraftList({ userId }) {
  const navigate = useNavigate()
  const [result, setResult] = useState(() => readDrafts(userId))
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const refresh = () => setResult(readDrafts(userId))
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [userId])

  function remove(draft) {
    const title = draft.formData.lobbyName || draft.formData.title || 'Untitled draft'
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return
    try {
      deleteDraft(userId, draft.id)
      setResult(readDrafts(userId))
      setMessage('Draft deleted.')
    } catch {
      setMessage('')
      setResult((current) => ({ ...current, error: 'Unable to delete draft. Please try again.' }))
    }
  }

  const visible = result.drafts.filter((draft) => filter === 'all' || draft.type === filter)
  return (
    <div className="profile-page page-enter">
      <section className="profile-card drafts-page" aria-labelledby="drafts-title">
        <button className="back-button" type="button" aria-label="Back to Profile" onClick={() => navigate('/profile')}>
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <header className="create-flow-heading">
          <p className="profile-eyebrow">Your work in progress</p>
          <h1 id="drafts-title">My Drafts</h1>
          <p>Pick up where you left off. Drafts are saved only in this browser.</p>
        </header>
        <nav className="drafts-actions" aria-label="Create content">
          <Link className="mini-chip" to="/create-lobby" state={{ from: '/drafts' }}>New Lobby</Link>
          <Link className="mini-chip" to="/create-post" state={{ from: '/drafts' }}>New Post</Link>
        </nav>
        <div className="tag-row" role="group" aria-label="Filter drafts">
          {[['all', 'All'], ['lobby', 'Lobbies'], ['post', 'Posts']].map(([value, label]) => (
            <button key={value} type="button" className={`mini-chip ${filter === value ? 'mini-chip-dark' : ''}`}
              aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <p role="status" aria-live="polite">{message}</p>
        {result.error && <p role="alert" className="field-error">{result.error}</p>}
        {result.error && <button type="button" className="mini-chip" onClick={() => setResult(readDrafts(userId))}>Retry loading drafts</button>}
        {visible.length ? (
          <ul className="drafts-list">
            {visible.map((draft) => (
              <li className="profile-section draft-row" key={draft.id}>
                <div>
                  <p className="profile-eyebrow">{draft.type === 'lobby' ? 'Lobby' : 'Forum Post'}</p>
                  <h2>{(draft.formData.lobbyName || draft.formData.title || '').trim() || 'Untitled draft'}</h2>
                  <p className="draft-updated">Last modified <time dateTime={draft.updatedAt}>{new Date(draft.updatedAt).toLocaleString()}</time></p>
                </div>
                <div className="drafts-actions">
                  <Link className="mini-chip" to={`/create-${draft.type}?draftId=${encodeURIComponent(draft.id)}`} state={{ from: '/drafts' }}>Continue Editing</Link>
                  <button className="footer-action footer-delete" type="button" onClick={() => remove(draft)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ) : !result.error && (
          <div className="drafts-empty" role="status">
            <h2>{filter === 'all' ? 'No drafts yet' : `No ${filter === 'lobby' ? 'lobby' : 'post'} drafts`}</h2>
            <p>Start a Lobby or Forum Post and choose Save to keep it here.</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default function Drafts() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/signin" replace />
  return <DraftList key={user.id} userId={user.id} />
}
