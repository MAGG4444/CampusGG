export default function CurrentLobbySection({ lobby, onOpen }) {
  if (!lobby) return null
  return <section className="current-lobby" aria-labelledby="current-lobby-title">
    <div className="current-lobby-info">
      <h2 id="current-lobby-title">Your Current Lobby</h2>
      <p className="current-lobby-name">{lobby.lobbyName}</p>
      <p className="current-lobby-meta">{lobby.game || 'Game not specified'} · {lobby.role === 'host' ? 'Host' : 'Member'}</p>
    </div>
    <button type="button" className="join-button" onClick={() => onOpen(lobby.id)}>Open Lobby</button>
  </section>
}
