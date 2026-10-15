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
        <h2 className="lobby-card-title">{lobbyName}</h2>
        <p className="lobby-card-host">Hosted by <strong>{userName}</strong></p>
        <p className="lobby-card-details">{details}</p>
      </div>
      <button className="join-button" type="button" onClick={onJoin}>
        {isJoined ? 'Open Lobby' : 'Join Lobby'}
      </button>
    </article>
  )
}

export default LobbyCard
