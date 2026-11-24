import { useState } from 'react'
import { ArrowLeft, Clock3, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import ChatAvatar from './chat/ChatAvatar.jsx'

export default function FindFriends({ people, status, onRetry, onBack, incoming = null, outgoing = null, recentPeople = null, onAction, onMessage, games = [], selectedGame = '', missingGame = null, onGameChange }) {
  const [drawer, setDrawer] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const gameLabel = missingGame || selectedGame
  const showGameSelect = games.length > 1
  const selected = [...people, ...(recentPeople || []), ...(incoming || []), ...(outgoing || [])].find(person => person.id === selectedId)
  function actions(person) {
    if (person.relationship === 'friend') return <button type="button" disabled={!onMessage} onClick={() => onMessage?.(person)}>Message</button>
    if (person.relationship === 'incoming') return <><button type="button" disabled={!onAction} onClick={() => onAction?.(person, 'accept')}>Accept</button><button type="button" disabled={!onAction} onClick={() => onAction?.(person, 'decline')}>Decline</button></>
    if (person.relationship === 'outgoing') return <button type="button" disabled={!onAction} onClick={() => onAction?.(person, 'cancel')}>Cancel Request</button>
    return <button type="button" disabled={!onAction || person.relationship !== 'none'} title={!onAction ? 'Friend management unavailable' : undefined} onClick={() => onAction?.(person, 'request')}>Add Friend</button>
  }
  function requestRow(person) { return <li key={person.id} className="find-friends-row"><button type="button" className="find-friends-person" onClick={() => { setSelectedId(person.id); setDrawer(null) }}><ChatAvatar name={person.name} /><span><strong>{person.name}</strong>{person.username && <small>@{person.username}</small>}</span></button><div className="connection-actions">{actions(person)}</div></li> }
  function playerCard(person) {
    const relationship = ({ friend: 'Friends', incoming: 'Incoming', outgoing: 'Pending', none: 'Not connected' })[person.relationship]
    return <li key={person.id} className="find-friends-row find-player-card">
      <button type="button" className="find-friends-person" onClick={() => setSelectedId(person.id)}>
        <span className="find-card-header"><ChatAvatar name={person.name} /><span className="find-card-identity"><strong title={person.name}>{person.name}</strong>{person.username && <small title={`@${person.username}`}>@{person.username}</small>}</span></span>
        {person.game && <span className="find-card-meta" title={person.game}>{person.game}</span>}
      </button>
      <div className="find-card-footer"><div className="connection-actions">{actions(person)}</div>{relationship && <span className="find-card-status">{relationship}</span>}</div>
    </li>
  }
  return <div className="find-friends">
    <header className="find-friends-header"><button type="button" className="chat-mobile-back" aria-label="Back to friends" onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button><h2>Find Friends</h2><div className="find-friends-tools"><button type="button" className="connection-icon-button" aria-label="Received Requests" aria-expanded={drawer === 'incoming'} onClick={() => setDrawer(drawer === 'incoming' ? null : 'incoming')}><Inbox size={19} aria-hidden="true" /></button><button type="button" className="connection-icon-button" aria-label="Sent Requests" aria-expanded={drawer === 'outgoing'} onClick={() => setDrawer(drawer === 'outgoing' ? null : 'outgoing')}><Clock3 size={19} aria-hidden="true" /></button></div></header>
    <div className="find-friends-body">
      {drawer ? <section aria-label={drawer === 'incoming' ? 'Received Requests' : 'Sent Requests'}><div className="find-friends-section-heading"><h3>{drawer === 'incoming' ? 'Received Requests' : 'Sent Requests'}</h3><button type="button" onClick={() => setDrawer(null)}>Close</button></div>{(drawer === 'incoming' ? incoming : outgoing) === null ? <p>Friend requests are not available yet.</p> : (drawer === 'incoming' ? incoming : outgoing).length ? <ul>{(drawer === 'incoming' ? incoming : outgoing).map(requestRow)}</ul> : <p>No pending requests.</p>}</section> : selected ? <section className="find-friends-profile"><button type="button" className="connection-back-link" onClick={() => setSelectedId(null)}>← Back to Find Friends</button><ChatAvatar name={selected.name} size="profile" /><h3>{selected.name}</h3>{selected.username && <p>@{selected.username}</p>}<p>{selected.bio || 'No bio yet.'}</p><dl><div><dt>Favorite games</dt><dd>{selected.game || 'Not set'}</dd></div><div><dt>Skill level</dt><dd>{selected.experienceLevel || 'Not set'}</dd></div><div><dt>Relationship</dt><dd>{({ friend: 'Friends', incoming: 'Incoming request', outgoing: 'Request pending', none: 'Not connected' })[selected.relationship] || 'Unavailable'}</dd></div></dl>{selected.reasons?.length > 0 && <><h3>Why you match</h3><ul>{selected.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></>}<div className="connection-actions">{actions(selected)}</div>{!onAction && !onMessage && <p>Friend management is not available yet.</p>}</section> : <>
        <label className="find-friends-search">Search CampusGG Players<input type="search" placeholder="Player search unavailable" disabled /></label><p>CampusGG player search is not available yet.</p>
        <section className="find-player-section"><h3>Recently Played With</h3>{recentPeople === null ? <p>Recent shared Lobby history is not available yet.</p> : recentPeople.length ? <ul className="find-player-grid">{recentPeople.map(playerCard)}</ul> : <p>No recent players found.</p>}</section>
        <section className="find-player-section">
          <div className="find-player-heading">
            <h3>Suggested Players</h3>
            {showGameSelect
              ? <label className="find-player-game"><span>Game</span><select aria-label="Suggested players game" value={selectedGame} onChange={event => onGameChange?.(event.target.value)}>{games.map(game => <option key={game} value={game}>{game}</option>)}</select></label>
              : selectedGame ? <span className="find-player-game-label">{selectedGame}</span> : null}
          </div>
          {status === 'signin' ? <p>Sign in to see suggested teammates.</p> : status === 'loading' || status === 'idle' ? <p role="status">Looking for compatible players…</p> : status === 'error' ? <p role="alert">Could not load suggested teammates. <button type="button" onClick={onRetry}>Try again</button></p> : status === 'profile' ? <p>Add {gameLabel || 'a game'} to your profile to see suggestions. <Link to="/profile">Update profile</Link></p> : people.length ? <ul className="find-player-grid">{people.map(playerCard)}</ul> : <p>{gameLabel ? `No compatible ${gameLabel} players yet.` : 'No suggested players found.'} Check back after more students join.</p>}
        </section>
      </>}
    </div>
  </div>
}
