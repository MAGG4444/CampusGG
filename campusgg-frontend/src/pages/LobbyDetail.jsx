import { useMemo, useState } from 'react'
import { ArrowLeft, Filter } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import LobbyMemberCard from '../components/LobbyMemberCard.jsx'
import Pagination from '../components/Pagination.jsx'
import { useJoinedLobbies } from '../context/useJoinedLobbies.js'
import { lobbies } from '../data/lobbies.js'
import './Lobby.css'
import './LobbyDetail.css'

const MEMBERS_PER_PAGE = 4
const currentUser = {
  id: 'current-user',
  username: 'You',
  status: 'Online',
  details: 'Current user joined locally for this session.',
}

function LobbyDetail() {
  const navigate = useNavigate()
  const { lobbyId } = useParams()
  const { isLobbyJoined, joinLobby, leaveLobby } = useJoinedLobbies()
  const lobby = lobbies.find((currentLobby) => String(currentLobby.id) === lobbyId)
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [currentPage, setCurrentPage] = useState(1)
  const [feedback, setFeedback] = useState('')

  const participants = useMemo(() => {
    if (!lobby) {
      return []
    }

    const isJoined = isLobbyJoined(lobby.id)

    return isJoined ? [...lobby.participants, currentUser] : lobby.participants
  }, [isLobbyJoined, lobby])

  if (!lobby) {
    return (
      <div className="lobby-detail-wrapper">
        <section className="lobby-not-found">
          <h1>Lobby not found.</h1>
          <button className="lobby-return-button" type="button" onClick={() => navigate('/lobby')}>
            Return to Lobby
          </button>
        </section>
      </div>
    )
  }

  const isUnlimited = lobby.participantLimit === 'unlimited'
  const isJoined = isLobbyJoined(lobby.id)
  const isFull = !isUnlimited && participants.length >= lobby.participantLimit
  const canJoin = isJoined || !isFull
  const filteredParticipants =
    statusFilter === 'Online'
      ? participants.filter((participant) => participant.status === 'Online')
      : participants
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / MEMBERS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const firstMemberIndex = (safeCurrentPage - 1) * MEMBERS_PER_PAGE
  const visibleParticipants = filteredParticipants.slice(firstMemberIndex, firstMemberIndex + MEMBERS_PER_PAGE)
  const participantLimitLabel = isUnlimited ? 'Unlimited' : lobby.participantLimit

  function statusClassName(status) {
    return `filter-chip ${statusFilter === status ? 'filter-chip-selected' : ''}`
  }

  function selectStatusFilter(status) {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  function handleBack() {
    navigate('/lobby')
  }

  function handleJoin() {
    if (isFull) {
      setFeedback('Lobby Full')
      return
    }

    joinLobby(lobby.id)
    setFeedback('Joined lobby.')
  }

  function handleLeave() {
    leaveLobby(lobby.id)
    setFeedback('Left lobby.')
    navigate('/lobby')
  }

  return (
    <div className="lobby-detail-wrapper">
      <button className="lobby-detail-back-button" type="button" aria-label="Back to Lobby Feed" onClick={handleBack}>
        <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
      </button>

      <section className="lobby-detail-header">
        <div className="lobby-title-block">
          <div className="lobby-title-row">
            <div>
              <h1>{lobby.lobbyName}</h1>
              <p>{lobby.subtitle}</p>
            </div>
            <button
              className={`lobby-join-toggle ${isJoined ? 'lobby-leave-toggle' : ''}`}
              type="button"
              onClick={isJoined ? handleLeave : handleJoin}
              disabled={!canJoin}
            >
              {isJoined ? 'Leave' : isFull ? 'Lobby Full' : 'Join'}
            </button>
          </div>

          <div className="lobby-tags-section">
            <span className="lobby-detail-label">Tags:</span>
            <div className="tag-row" aria-label="Lobby tags">
              {lobby.tags.map((tag) => (
                <span className="mini-chip mini-chip-dark" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="lobby-count-line">
            {participants.length} / {participantLimitLabel} participants · {lobby.visibility}
          </p>
        </div>
      </section>

      <div className="lobby-detail-feedback" aria-live="polite">
        {feedback}
      </div>

      <section className="lobby-info-box" aria-label="Lobby information">
        <p>{lobby.details}</p>
      </section>

      <section className="lobby-status-row" aria-label="Player status filter">
        <Filter className="filter-icon" size={13} strokeWidth={2.3} aria-hidden="true" />
        <button className={statusClassName('All Status')} type="button" onClick={() => selectStatusFilter('All Status')}>
          {statusFilter === 'All Status' ? '✓ ' : ''}
          All Status
        </button>
        <button className={statusClassName('Online')} type="button" onClick={() => selectStatusFilter('Online')}>
          {statusFilter === 'Online' ? '✓ ' : ''}
          Online
        </button>
      </section>

      {visibleParticipants.length > 0 ? (
        <section className="member-grid" aria-label="Lobby members">
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
        <div className="feed-state-message lobby-member-empty">No players found.</div>
      )}

      <section className="lobby-detail-bottom" aria-label="Lobby detail bottom controls">
        <div />
        <Pagination currentPage={safeCurrentPage} totalPages={totalPages} onSelectPage={setCurrentPage} />
        <img className="corner-logo" src={logo} alt="CampusGG logo" />
      </section>
    </div>
  )
}

export default LobbyDetail
