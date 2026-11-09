import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { matchmakingGames as GAMES } from '../utils/supportedGames.js'
import './Matchmaking.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Role options per game. Games without fixed roles (Rocket League, It Takes Two)
 * map to an empty array, so the role sections are hidden for those titles.
 */
const GAME_ROLES = {
  CS2: ['IGL', 'Entry', 'AWPer', 'Lurker', 'Support'],
  Valorant: ['Controller', 'Duelist', 'Initiator', 'Sentinel'],
  'League of Legends': ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
  Dota: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'],
  OW2: ['Tank', 'Damage', 'Support'],
  'Rocket League': [],
  'It Takes Two': [],
}

const initialForm = {
  game: 'CS2',
  rating: 15000,
  primaryRole: 'IGL',
  secondaryRole: 'Support',
  micEnabled: true,
  intensity: 0.5,
}

function Matchmaking() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const pollInterval = useRef(null)
  const epoch = useRef(0)
  const cancelling = useRef(false)

  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle') // idle | queuing | matched | error
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Roles available for the currently selected game.
  const availableRoles = GAME_ROLES[form.game] ?? []
  const hasRoles = availableRoles.length > 0

  // Require authentication before accessing the queue.
  // Remember where we were so we can return after sign-in.
  useEffect(() => {
    if (!token) {
      navigate('/signin', { state: { from: '/matchmaking' } })
    }
  }, [token, navigate])

  const getStatus = useCallback(async () => {
    const response = await fetch(`${API_URL}/matchmaking/match-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Unable to check matchmaking status.')
    return response.json()
  }, [token])

  const applyStatus = useCallback((data) => {
    if (data.matched && data.lobbyId) {
      setStatus('matched')
      navigate(`/lobby/${data.lobbyId}`)
      return true
    }
    if (data.error) {
      setStatus('idle')
      setFeedback(data.error)
      return true
    }
    if (data.processing || data.queued) {
      setStatus('queuing')
      setFeedback(data.processing ? 'Your match is being created.' : '')
      return true
    }
    return false
  }, [navigate])

  useEffect(() => {
    if (!token || !user?.id) return undefined
    let active = true
    const current = epoch.current
    getStatus().then((data) => {
      if (active && current === epoch.current) applyStatus(data)
    }).catch(() => {
      if (active && current === epoch.current) setFeedback('Unable to check matchmaking status. Please try again.')
    })
    return () => { active = false }
  }, [token, user?.id, getStatus, applyStatus])

  useEffect(() => {
    if (status !== 'queuing' || !token) return undefined
    let active = true
    const poll = async () => {
      if (cancelling.current) return
      const current = epoch.current
      try {
        const data = await getStatus()
        if (active && current === epoch.current) {
          if (!applyStatus(data)) {
            setStatus('idle')
            setFeedback('Your queue is no longer active. You can try again.')
          }
        }
      } catch {
        // Retry transient polling errors on the next interval.
      }
    }
    pollInterval.current = setInterval(poll, 3000)
    return () => { active = false; clearInterval(pollInterval.current); pollInterval.current = null }
  }, [status, token, getStatus, applyStatus])

  // Handle game selection change: switch game and validate/reset role
  // selections in the same event, avoiding a setState-in-effect pattern.
  function handleGameChange(game) {
    const roles = GAME_ROLES[game] ?? []

    setForm((prev) => {
      if (roles.length === 0) {
        return { ...prev, game, primaryRole: '', secondaryRole: '' }
      }

      const validPrimary = roles.includes(prev.primaryRole)
      const validSecondary = roles.includes(prev.secondaryRole)

      return {
        ...prev,
        game,
        primaryRole: validPrimary ? prev.primaryRole : roles[0],
        secondaryRole:
          validSecondary && prev.secondaryRole !== prev.primaryRole
            ? prev.secondaryRole
            : roles.length > 1
              ? roles[1]
              : roles[0],
      }
    })
    setFeedback('')
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFeedback('')
  }

  async function handleJoinQueue(event) {
    event.preventDefault()
    if (!token || !user) return

    setIsSubmitting(true)
    setFeedback('')
    const current = ++epoch.current

    // Build the PlayerMatchmakingInput payload the backend expects.
    const player = {
      userId: user.id,
      game: form.game,
      profile: {
        universityDomain: 'purdue.edu',
        major: 'Computer Science',
        activeSchedule: 'Weekday Evening',
      },
      stats: {
        game: form.game,
        rating: form.rating,
      },
      preferences: {
        primaryRole: form.primaryRole,
        secondaryRole: form.secondaryRole,
        micEnabled: form.micEnabled,
      },
      intensity: form.intensity,
      queueTime: 0,
    }

    try {
      const existing = await getStatus()
      if (current !== epoch.current) return
      if (applyStatus(existing)) {
        // A previous failure is recoverable by explicitly trying again.
        if (!existing.error) return
      }
      const response = await fetch(`${API_URL}/matchmaking/enqueue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(player),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 409) {
          const latest = await getStatus()
          if (current === epoch.current && applyStatus(latest)) return
        }
        const message =
          data.message ||
          (response.status === 401
            ? 'Your login session has expired. Please sign in again.'
            : 'Unable to join queue.')
        throw new Error(message)
      }

      if (current === epoch.current) { setFeedback(''); setStatus('queuing') }
    } catch (error) {
      setStatus('idle')
      setFeedback(
        error instanceof Error ? error.message : 'Unable to join queue.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!token || !user || isSubmitting) return
    setIsSubmitting(true)
    const current = ++epoch.current
    cancelling.current = true
    try {
        const response = await fetch(`${API_URL}/matchmaking/dequeue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        })
        if (!response.ok) throw new Error('Unable to cancel the queue. Please try again.')
        const data = await response.json()
        if (current !== epoch.current) return
        if (data.status === 'cancelled') {
          setStatus('idle')
          setFeedback('Queue cancelled.')
        } else if (data.status === 'matched' && data.lobbyId) {
          applyStatus({ matched: true, lobbyId: data.lobbyId })
        } else if (data.status === 'processing') {
          setStatus('queuing')
          setFeedback('Your match is being created and can no longer be cancelled.')
        } else {
          setStatus('idle')
          setFeedback(data.error || 'Your queue is no longer active.')
        }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to cancel the queue.')
    } finally {
      cancelling.current = false
      setIsSubmitting(false)
    }
  }

  // Clean up the poll interval on unmount.
  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current)
      }
    }
  }, [])

  const isQueuing = status === 'queuing'

  return (
    <div className="matchmaking-wrapper page-enter">
      <button
        className="matchmaking-back-button"
        type="button"
        aria-label="Back to Home"
        onClick={() => navigate('/')}
      >
        &larr;
      </button>

      <header className="matchmaking-heading">
        <p className="page-kicker">Find teammates</p>
        <h1>Join the Queue</h1>
        <p>
          Select your game and preferences, then click Join Queue. We will
          match you with compatible players and create a lobby for your squad.
        </p>
      </header>

      {feedback && status === 'error' && (
        <div className="matchmaking-feedback error">{feedback}</div>
      )}

      <form className="matchmaking-form" onSubmit={handleJoinQueue}>
        <div className="form-group">
          <label className="field-label" htmlFor="game">
            Game
          </label>
          <select
            id="game"
            className="field-input"
            value={form.game}
            onChange={(e) => handleGameChange(e.target.value)}
          >
            {GAMES.map((game) => (
              <option key={game} value={game}>
                {game}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="field-label" htmlFor="rating">
            Skill Rating
          </label>
          <input
            id="rating"
            className="field-input"
            type="number"
            min="0"
            max="35000"
            value={form.rating}
            onChange={(e) =>
              updateField('rating', Number(e.target.value) || 0)
            }
            placeholder="e.g. 15000"
          />
        </div>

        {hasRoles && (
          <>
            <div className="form-group inline-group">
              <span className="field-label">Primary Role</span>
              <div className="chip-row">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    className={`chip ${
                      form.primaryRole === role ? 'chip-selected' : ''
                    }`}
                    type="button"
                    aria-pressed={form.primaryRole === role}
                    onClick={() => updateField('primaryRole', role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group inline-group">
              <span className="field-label">Secondary Role</span>
              <div className="chip-row">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    className={`chip ${
                      form.secondaryRole === role ? 'chip-selected' : ''
                    }`}
                    type="button"
                    aria-pressed={form.secondaryRole === role}
                    onClick={() => updateField('secondaryRole', role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="form-group">
          <div className="checkbox-group">
            <input
              id="mic"
              className="checkbox-input"
              type="checkbox"
              checked={form.micEnabled}
              onChange={(e) => updateField('micEnabled', e.target.checked)}
            />
            <label htmlFor="mic" className="field-label">
              I have a microphone
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="field-label" htmlFor="intensity">
            Play Intensity
          </label>
          <input
            id="intensity"
            className="field-input"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={form.intensity}
            onChange={(e) => updateField('intensity', Number(e.target.value))}
          />
          <span className="intensity-label">
            {form.intensity === 0
              ? 'Casual'
              : form.intensity === 1
                ? 'Hardcore'
                : 'Balanced'}
          </span>
        </div>

        <div className="matchmaking-actions">
          <button
            className="footer-action footer-cancel"
            type="button"
            disabled={isQueuing || isSubmitting}
            onClick={handleCancel}
          >
            {isQueuing ? 'Cancel Queue' : 'Cancel'}
          </button>

          <button
            className="footer-action footer-queue"
            type="submit"
            disabled={isQueuing || isSubmitting || !token}
          >
            {isSubmitting
              ? 'Joining...'
              : isQueuing
                ? 'In Queue...'
                : 'Join Queue'}
          </button>
        </div>

        {feedback && !isQueuing && (
          <div className="matchmaking-feedback">{feedback}</div>
        )}
      </form>

      {isQueuing && (
        <div className="matchmaking-queueing">
          <p>{feedback || 'Searching for compatible players…'}</p>
          <p className="queueing-hint">
            We will check for a match every few seconds and move you to a
            lobby automatically when your squad is ready.
          </p>
          <button
            className="footer-action footer-cancel"
            type="button"
            disabled={isSubmitting}
            onClick={handleCancel}
          >
            Cancel Queue
          </button>
        </div>
      )}

    </div>
  )
}

export default Matchmaking
