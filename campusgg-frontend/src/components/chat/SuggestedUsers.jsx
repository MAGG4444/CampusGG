import { useEffect, useRef, useState } from 'react'
import { Gamepad2, GraduationCap, Sparkles, UsersRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSuggestedUsers } from '../../api/recommendations.js'
import { useAuth } from '../../context/useAuth.js'

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function SuggestedUserDetails({ item, onClose }) {
  const dialogRef = useRef(null)
  const { user, reasons } = item

  useEffect(() => {
    dialogRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="suggested-user-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="suggested-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggested-user-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="suggested-user-modal-header">
          <div className="suggested-user-modal-identity">
            <span className="suggested-avatar suggested-avatar-large" aria-hidden="true">
              {initials(user.displayName)}
            </span>
            <div>
              <p className="suggested-user-modal-eyebrow">Suggested teammate</p>
              <h2 id="suggested-user-title">{user.displayName}</h2>
              <span>@{user.username}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close suggested teammate details">
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <div className="suggested-user-modal-body">
          {user.bio ? <p className="suggested-user-bio">{user.bio}</p> : (
            <p className="suggested-user-bio suggested-user-bio-empty">No bio yet.</p>
          )}

          {reasons.length > 0 ? (
            <ul className="suggested-user-reasons" aria-label="Why this player fits">
              {reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}

          <dl className="suggested-user-facts">
            <div>
              <dt><Gamepad2 size={14} aria-hidden="true" /> Game</dt>
              <dd>{user.game}</dd>
            </div>
            <div>
              <dt>Skill level</dt>
              <dd>{user.experienceLevel ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Preferred roles</dt>
              <dd>{user.preferredRoles.length > 0 ? user.preferredRoles.join(', ') : 'Any role'}</dd>
            </div>
            <div>
              <dt><GraduationCap size={14} aria-hidden="true" /> Campus</dt>
              <dd>{user.campusDomain ?? 'Not shared'}</dd>
            </div>
          </dl>

          <p className="suggested-user-note">
            Discovery only — CampusGG does not support connection requests or
            direct messages yet.
          </p>
        </div>
      </section>
    </div>
  )
}

function SuggestedUsers() {
  const { isAuthenticated, token } = useAuth()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [items, setItems] = useState([])
  const [needsProfile, setNeedsProfile] = useState(false)
  const [selected, setSelected] = useState(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (!open || !isAuthenticated || !token || requestedRef.current) {
      return undefined
    }

    requestedRef.current = true
    const controller = new AbortController()
    setStatus('loading')
    getSuggestedUsers(token, { limit: 5, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setItems(Array.isArray(data?.items) ? data.items : [])
        setNeedsProfile(Boolean(data?.needsProfile))
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })

    return () => {
      controller.abort()
      requestedRef.current = false
    }
  }, [open, isAuthenticated, token])

  if (!isAuthenticated) return null
  if (status === 'error') return null

  return (
    <>
      <details
        className="suggested-users"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="suggested-users-title">
            <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
            Suggested teammates
          </span>
          {status === 'ready' && !needsProfile ? (
            <span className="suggested-users-count">{items.length}</span>
          ) : null}
        </summary>

        <div className="suggested-users-body">
          {status === 'loading' || status === 'idle' ? (
            <p className="suggested-users-status">Looking for compatible players…</p>
          ) : needsProfile ? (
            <p className="suggested-users-status">
              Add a game to your profile to see suggested teammates.{' '}
              <Link to="/profile">Update profile</Link>
            </p>
          ) : items.length === 0 ? (
            <p className="suggested-users-status">
              No compatible players yet. Check back after more students join.
            </p>
          ) : (
            <ul className="suggested-users-list">
              {items.map((item) => (
                <li key={item.user.id}>
                  <button
                    type="button"
                    className="suggested-user-card"
                    onClick={() => setSelected(item)}
                  >
                    <span className="suggested-avatar" aria-hidden="true">
                      {initials(item.user.displayName)}
                    </span>
                    <span className="suggested-user-copy">
                      <strong>{item.user.displayName}</strong>
                      <span>
                        {item.user.game}
                        {item.user.experienceLevel ? ` · ${item.user.experienceLevel}` : ''}
                      </span>
                      {item.reasons[0] ? (
                        <span className="suggested-user-reason">{item.reasons[0]}</span>
                      ) : null}
                    </span>
                    <UsersRound size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {selected ? (
        <SuggestedUserDetails item={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  )
}

export default SuggestedUsers
