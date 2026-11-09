import { Users } from 'lucide-react'
import { formatLobbyCapacity } from '../utils/lobbyFeedSync.js'

function LobbyCard({ lobbyName, userName, details, game, skillLevel, memberCount, participantLimit, visibility, isJoined, isJoining, onJoin, cardRef }) {
  const full = Number.isInteger(memberCount) && Number.isInteger(participantLimit) && memberCount >= participantLimit
  const unavailable = !isJoined && (isJoining || full || visibility === 'private' || visibility === 'friends')
  function moveGlow(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--glow-x', `${event.clientX - rect.left}px`)
    event.currentTarget.style.setProperty('--glow-y', `${event.clientY - rect.top}px`)
  }
  return <article ref={cardRef} className={`lobby-card${isJoined ? ' lobby-card-joined' : ''}`} onPointerMove={moveGlow}>
    <div className="lobby-card-heading">
      <h2 className="lobby-card-title">{lobbyName}</h2>
      <span className="lobby-game-badge">{game || 'Unspecified'}</span>
    </div>
    <div className="lobby-card-secondary">
      <p className="lobby-card-host">{userName} · {skillLevel || 'Any skill'}</p>
      <p className="lobby-card-description">{details || 'No description.'}</p>
    </div>
    <div className="lobby-card-footer">
      <span className="lobby-card-count"><Users size={15} aria-hidden="true" />{formatLobbyCapacity({ memberCount, participantLimit })}</span>
      <button className="join-button lobby-card-action" type="button" disabled={unavailable} onClick={onJoin}>
        {isJoined ? 'Open Lobby' : isJoining ? <><span className="lobby-spinner" aria-hidden="true" />Joining...</> : full ? 'Full' : unavailable ? 'Invite only' : 'Join Lobby'}
      </button>
    </div>
  </article>
}

export default LobbyCard
