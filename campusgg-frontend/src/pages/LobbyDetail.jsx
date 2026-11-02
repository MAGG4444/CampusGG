import { myContentReturnTo } from '../utils/myContentNavigation.js'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Filter } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import logo from '../assets/LOGO.png'
import LobbyMemberCard from '../components/LobbyMemberCard.jsx'
import Pagination from '../components/Pagination.jsx'

import { useAuth } from '../context/useAuth.js'
import { useJoinedLobbies } from '../context/useJoinedLobbies.js'

import './Lobby.css'
import './LobbyDetail.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const MEMBERS_PER_PAGE = 4

function LobbyDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = myContentReturnTo(location.state, '/lobby')
  const returnLabel = returnTo === '/lobby' ? 'Lobby Feed' : 'My Content'
  const { lobbyId } = useParams()

  const { user, token } = useAuth()
  const {
    joinLobby,
    leaveLobby,
    refreshLobbyMembers,
  } = useJoinedLobbies()

  const [lobby, setLobby] = useState(null)
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [statusFilter, setStatusFilter] = useState('All Status')
  const [currentPage, setCurrentPage] = useState(1)
  const [feedback, setFeedback] = useState('')

  // ============================================================
  // LOAD LOBBY AND MEMBERS FROM POSTGRESQL
  // ============================================================

  useEffect(() => {
    let cancelled = false

    async function loadLobby() {
      setIsLoading(true)
      setLoadError('')

      try {
        const response = await fetch(
          `${API_URL}/lobbies/${encodeURIComponent(lobbyId)}`,
        )

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Lobby not found.'
              : 'Unable to load lobby.',
          )
        }

        const lobbyData = await response.json()

        const members = token
          ? await refreshLobbyMembers(lobbyId)
          : []

        if (!cancelled) {
          setLobby(lobbyData)
          setParticipants(members)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load lobby.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadLobby()

    return () => {
      cancelled = true
    }
  }, [lobbyId, token, refreshLobbyMembers])

  // ============================================================
  // MEMBERSHIP AND CAPACITY
  // ============================================================

  const currentMembership = participants.find(
    (participant) => participant.id === user?.id,
  )

  const isJoined = Boolean(currentMembership)
  const isHost = currentMembership?.role === 'host'

  const isUnlimited = lobby?.participantLimit == null

  const isFull =
    !isUnlimited &&
    participants.length >= lobby.participantLimit

  // Presence tracking is not connected yet.
  // Do not report members as online without actual status data.
  const displayParticipants = useMemo(
    () =>
      participants.map((participant) => ({
        ...participant,
        status: 'Unknown',
        details:
          participant.role === 'host'
            ? 'Lobby host'
            : 'Lobby member',
      })),
    [participants],
  )

  const filteredParticipants =
    statusFilter === 'Online'
      ? displayParticipants.filter(
          (participant) => participant.status === 'Online',
        )
      : displayParticipants

  const totalPages = Math.max(
    1,
    Math.ceil(filteredParticipants.length / MEMBERS_PER_PAGE),
  )

  const safeCurrentPage = Math.min(currentPage, totalPages)

  const firstMemberIndex =
    (safeCurrentPage - 1) * MEMBERS_PER_PAGE

  const visibleParticipants = filteredParticipants.slice(
    firstMemberIndex,
    firstMemberIndex + MEMBERS_PER_PAGE,
  )

  // ============================================================
  // JOIN AND LEAVE ACTIONS
  // ============================================================

  async function handleJoin() {
    if (!token) {
      navigate('/signin')
      return
    }

    if (isFull) {
      setFeedback('Lobby Full')
      return
    }

    if (lobby.visibility !== 'public') {
      setFeedback('This lobby requires an invitation.')
      return
    }

    setIsSubmitting(true)
    setFeedback('')

    try {
      await joinLobby(lobby.id)

      const members = await refreshLobbyMembers(lobby.id)
      setParticipants(members)

      setFeedback('Joined lobby successfully.')
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Unable to join lobby.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLeave() {
    setIsSubmitting(true)
    setFeedback('')

    try {
      await leaveLobby(lobby.id)
      navigate(returnTo)
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Unable to leave lobby.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function selectStatusFilter(status) {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  function statusClassName(status) {
    return `filter-chip ${
      statusFilter === status ? 'filter-chip-selected' : ''
    }`
  }

  // ============================================================
  // LOADING AND ERROR STATES
  // ============================================================

  if (isLoading) {
    return (
      <div className="lobby-detail-wrapper">
        <div className="feed-state-message">
          Loading lobby...
        </div>
      </div>
    )
  }

  if (loadError || !lobby) {
    return (
      <div className="lobby-detail-wrapper">
        <section className="lobby-not-found">
          <h1>{loadError || 'Lobby not found.'}</h1>

          <button
            className="lobby-return-button"
            type="button"
            onClick={() => navigate(returnTo)}
          >
            Return to {returnLabel}
          </button>
        </section>
      </div>
    )
  }

  const participantLimitLabel = isUnlimited
    ? 'Unlimited'
    : lobby.participantLimit

  const joinButtonLabel = isSubmitting
    ? 'Processing...'
    : isHost
      ? 'Hosting'
      : isJoined
        ? 'Leave'
        : !token
          ? 'Sign In to Join'
          : lobby.visibility !== 'public'
            ? 'Invite Only'
            : isFull
              ? 'Lobby Full'
              : 'Join'

  const joinDisabled =
    isSubmitting ||
    isHost ||
    (!isJoined &&
      (isFull || lobby.visibility !== 'public'))

  // ============================================================
  // RENDER EXISTING LOBBY DETAIL UI
  // ============================================================

  return (
    <div className="lobby-detail-wrapper page-enter">
      <button
        className="lobby-detail-back-button"
        type="button"
        aria-label={`Back to ${returnLabel}`}
        onClick={() => navigate(returnTo)}
      >
        <ArrowLeft
          size={28}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>

      <section className="lobby-detail-header">
        <div className="lobby-title-block">
          <p className="lobby-detail-eyebrow">
            Lobby room
          </p>

          <div className="lobby-title-row">
            <div>
              <h1>{lobby.lobbyName}</h1>
              <p>{lobby.subtitle}</p>
            </div>

            <button
              className={`lobby-join-toggle ${
                isJoined && !isHost
                  ? 'lobby-leave-toggle'
                  : ''
              }`}
              type="button"
              onClick={
                isJoined ? handleLeave : handleJoin
              }
              disabled={joinDisabled}
            >
              {joinButtonLabel}
            </button>
          </div>

          <div className="lobby-tags-section">
            <span className="lobby-detail-label">
              Tags:
            </span>

            <div
              className="tag-row"
              aria-label="Lobby tags"
            >
              {(lobby.tags ?? []).map((tag) => (
                <span
                  className="mini-chip mini-chip-dark"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <p className="lobby-count-line">
            {token
              ? `${participants.length} / ${participantLimitLabel} participants`
              : 'Sign in to view participants'}
            {' · '}
            {lobby.visibility}
          </p>
        </div>
      </section>

      <div
        className="lobby-detail-feedback"
        aria-live="polite"
        role="status"
      >
        {feedback}
      </div>

      <section
        className="lobby-info-box"
        aria-label="Lobby information"
      >
        <p>{lobby.details}</p>
      </section>

      <section
        className="lobby-status-row"
        aria-label="Player status filter"
      >
        <Filter
          className="filter-icon"
          size={13}
          strokeWidth={2.3}
          aria-hidden="true"
        />

        <button
          className={statusClassName('All Status')}
          type="button"
          aria-pressed={statusFilter === 'All Status'}
          onClick={() => selectStatusFilter('All Status')}
        >
          {statusFilter === 'All Status' ? '✓ ' : ''}
          All Status
        </button>

        <button
          className={statusClassName('Online')}
          type="button"
          aria-pressed={statusFilter === 'Online'}
          onClick={() => selectStatusFilter('Online')}
          disabled
          title="Online status is not connected yet"
        >
          Online
        </button>
      </section>

      {visibleParticipants.length > 0 ? (
        <section
          className="member-grid"
          aria-label="Lobby members"
        >
          {visibleParticipants.map((participant) => (
            <LobbyMemberCard
              key={participant.id}
              username={participant.username}
              status={participant.status}
              details={participant.details}
            />
          ))}
        </section>
      ) : (
        <div className="feed-state-message lobby-member-empty">
          {token
            ? 'No players found.'
            : 'Sign in to view lobby members.'}
        </div>
      )}

      <section
        className="lobby-detail-bottom"
        aria-label="Lobby detail bottom controls"
      >
        <div />

        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onSelectPage={setCurrentPage}
        />

        <img
          className="corner-logo"
          src={logo}
          alt="CampusGG logo"
        />
      </section>
    </div>
  )
}

export default LobbyDetail
