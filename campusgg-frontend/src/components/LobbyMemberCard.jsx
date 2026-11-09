import { useState } from 'react'

function LobbyMemberCard({ username, status, details }) {
  const [isConnected, setIsConnected] = useState(false)

  return (
    <article className="member-card">
      <div className="member-card-content">
        <h3>{username}</h3>
        <p>
          <span>Status:</span> {status}
        </p>
        <p>
          <span>Details:</span> {details}
        </p>
      </div>
      <button
        className={`member-connect-button ${isConnected ? 'member-connect-button-active' : ''}`}
        type="button"
        onClick={() => setIsConnected((connected) => !connected)}
        aria-pressed={isConnected}
      >
        {isConnected ? 'Request Sent' : 'Add Connection'}
      </button>
    </article>
  )
}

export default LobbyMemberCard
