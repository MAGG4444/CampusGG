function LobbyCard({ lobbyName, userName, details, onJoin }) {
  return (
    <article className="lobby-card">
      <div className="lobby-card-content">
        <div className="lobby-line">{lobbyName}</div>
        <div className="lobby-line">{userName}</div>
        <div className="lobby-line">{details}</div>
      </div>
      <button className="join-button" type="button" onClick={onJoin}>
        Join Lobby
      </button>
    </article>
  )
}

export default LobbyCard
