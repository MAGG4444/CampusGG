import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import logo from '../assets/LOGO.png'
import './Matchmaking.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const GAMES = [
  'CS2',
  'Valorant',
  'Rocket League',
  'League of Legends',
  'Dota',
  'OW2',
  'It Takes Two',
]

const ROLES = ['IGL', 'Entry', 'AWPer', 'Lurker', 'Support']

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

  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle') // idle | queuing | matched | error
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Require authentication before accessing the queue.
  useEffect(() => {
    if (!token) {
      navigate('/signin')
    }
  }, [token, navigate])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFeedback('')
  }

  async function handleJoinQueue(event) {
    event.preventDefault()
    if (!token || !user) return

    setIsSubmitting(true)
    setFeedback('')
    setStatus('queuing')

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
        const message =
          data.message ||
          (response.status === 401
            ? 'Your login session has expired. Please sign in again.'
            : 'Unable to join queue.')
        throw new Error(message)
      }

      // Begin polling for a match result.
      pollInterval.current = setInterval(() => {
        checkMatchStatus(user.id)
      }, 3000)
      checkMatchStatus(user.id)
    } catch (error) {
      setStatus('idle')
      setFeedback(
        error instanceof Error ? error.message : 'Unable to join queue.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function checkMatchStatus(userId) {
    try {
      const response = await fetch(
        `${API_URL}/matchmaking/match-status?userId=${encodeURIComponent(
          userId,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        return
      }

      const data = await response.json()

      if (data.matched && data.lobbyId) {
        if (pollInterval.current) {
          clearInterval(pollInterval.current)
          pollInterval.current = null
        }
        setStatus('matched')
        navigate(`/lobby/${data.lobbyId}`)
      }
    } catch {
      // Silently ignore poll errors; the next interval will retry.
    }
  }

  function handleCancel() {
    if (pollInterval.current) {
      clearInterval(pollInterval.current)
      pollInterval.current = null
    }
    setStatus('idle')
    setFeedback('Queue cancelled.')
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
            onChange={(e) => updateField('game', e.target.value)}
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

        <div className="form-group inline-group">
          <span className="field-label">Primary Role</span>
          <div className="chip-row">
            {ROLES.map((role) => (
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
            {ROLES.map((role) => (
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

        <div className="form-group">
          <label className="field-label" htmlFor="mic">
            Microphone
          </label>
          <input
            id="mic"
            className="checkbox-input"
            type="checkbox"
            checked={form.micEnabled}
            onChange={(e) => updateField('micEnabled', e.target.checked)}
          />
          <span>I have a microphone</span>
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
          <p>Searching for compatible players…</p>
          <p className="queueing-hint">
            We will check for a match every few seconds and move you to a
            lobby automatically when your squad is ready.
          </p>
        </div>
      )}

      <img
        className="matchmaking-corner-logo"
        src={logo}
        alt="CampusGG logo"
      />
    </div>
  )
}

export default Matchmaking
