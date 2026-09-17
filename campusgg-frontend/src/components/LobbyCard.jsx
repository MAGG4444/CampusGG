import { Check } from 'lucide-react'

function LobbyCard({ lobbyName, userName, details, isJoined, onJoin }) {
  return (
    <article className="lobby-card">
      {isJoined ? (
        <div className="joined-indicator">
          <Check size={12} strokeWidth={2.4} aria-hidden="true" />
          <span>Joined</span>
        </div>
      ) : null}
      <div className="lobby-card-content">
        <div className="lobby-line">{lobbyName}</div>
        <div className="lobby-line">{userName}</div>
        <div className="lobby-line">{details}</div>
      </div>
      <button className="join-button" type="button" onClick={onJoin}>
        {isJoined ? 'Open Lobby' : 'Join Lobby'}
      </button>
    </article>
  )
}

export default LobbyCard
