import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Crown, X } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useJoinedLobbies } from '../context/useJoinedLobbies.js'
import { myContentReturnTo } from '../utils/myContentNavigation.js'
import LobbyChat from '../components/LobbyChat.jsx'
import './LobbyDetail.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const INITIAL_MEMBERS = 8

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

function LobbyDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = myContentReturnTo(location.state, '/lobby')
  const returnLabel = returnTo === '/lobby' ? 'Lobby Feed' : 'My Content'
  const { lobbyId } = useParams()
  const { user, token } = useAuth()
  const { joinLobby, leaveLobby, refreshLobbyMembers } = useJoinedLobbies()
  const [lobby, setLobby] = useState(null)
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const memberSectionRef = useRef(null)
  const avatarRefs = useRef(new Map())

  useEffect(() => {
    let cancelled = false
    async function loadLobby() {
      setIsLoading(true)
      setLoadError('')
      try {
        const response = await fetch(`${API_URL}/lobbies/${encodeURIComponent(lobbyId)}`)
        if (!response.ok) throw new Error(response.status === 404 ? 'Lobby not found.' : 'Unable to load lobby.')
        const lobbyData = await response.json()
        const members = token ? await refreshLobbyMembers(lobbyId) : []
        if (!cancelled) { setLobby(lobbyData); setParticipants(members) }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load lobby.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadLobby()
    return () => { cancelled = true }
  }, [lobbyId, token, refreshLobbyMembers])

  useEffect(() => {
    if (!selectedId) return undefined
    function handlePointer(event) {
      if (!memberSectionRef.current?.contains(event.target)) setSelectedId(null)
    }
    function handleKey(event) {
      if (event.key === 'Escape') {
        setSelectedId(null)
        avatarRefs.current.get(selectedId)?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [selectedId])

  const currentMembership = participants.find((member) => member.id === user?.id)
  const isJoined = Boolean(currentMembership)
  const isHost = currentMembership?.role === 'host'
  const isFull = lobby?.participantLimit != null && participants.length >= lobby.participantLimit
  const selectedMember = participants.find((member) => member.id === selectedId)
  const visibleMembers = expanded ? participants : participants.slice(0, INITIAL_MEMBERS)

  async function handleJoin() {
    if (!token) { navigate('/signin'); return }
    if (isFull || lobby.visibility !== 'public') return
    setIsSubmitting(true)
    setFeedback('')
    try {
      await joinLobby(lobby.id)
      setParticipants(await refreshLobbyMembers(lobby.id))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to join lobby.')
    } finally { setIsSubmitting(false) }
  }

  async function handleLeave() {
    if (!window.confirm('Leave this lobby?')) return
    setIsSubmitting(true)
    setFeedback('')
    try {
      await leaveLobby(lobby.id)
      navigate(returnTo)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to leave lobby.')
    } finally { setIsSubmitting(false) }
  }

  if (isLoading) return <div className="lobby-detail-wrapper"><p role="status">Loading lobby...</p></div>
  if (loadError || !lobby) return <div className="lobby-detail-wrapper"><section className="lobby-not-found">
    <h1>{loadError || 'Lobby not found.'}</h1>
    <button className="lobby-return-button" type="button" onClick={() => navigate(returnTo)}>Return to {returnLabel}</button>
  </section></div>

  return <div className="lobby-detail-wrapper page-enter">
    <button className="lobby-detail-back-button" type="button" aria-label={`Back to ${returnLabel}`} onClick={() => navigate(returnTo)}>
      <ArrowLeft size={24} aria-hidden="true" />
    </button>
    <header className="lobby-detail-header">
      <div className="lobby-title-row"><div><p className="lobby-detail-eyebrow">Lobby room</p><h1>{lobby.lobbyName}</h1></div>
        {isJoined ? <span className="lobby-status-badge">{isHost ? 'Host' : 'Joined'}</span> :
          <button className="lobby-join-toggle" type="button" onClick={handleJoin}
            disabled={isSubmitting || (token && (isFull || lobby.visibility !== 'public'))}>
            {isSubmitting ? 'Joining...' : !token ? 'Sign In to Join' : lobby.visibility !== 'public' ? 'Invite Only' : isFull ? 'Lobby Full' : 'Join Lobby'}
          </button>}
      </div>
      <p className="lobby-meta">{lobby.game || 'Game not specified'} <span aria-hidden="true">·</span> {token ? `${participants.length} / ${lobby.participantLimit ?? 'Unlimited'} players` : 'Sign in to view members'} <span aria-hidden="true">·</span> {lobby.visibility}</p>
      {lobby.subtitle && <p className="lobby-subtitle">{lobby.subtitle}</p>}
      {lobby.details && <p className="lobby-description">{lobby.details}</p>}
      {lobby.tags?.length > 0 && <div className="lobby-detail-tags" aria-label="Lobby tags">{lobby.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
    </header>
    {feedback && <p className="lobby-detail-feedback" role="alert">{feedback}</p>}
    <section className="lobby-members" aria-labelledby="lobby-members-title" ref={memberSectionRef}>
      <h2 id="lobby-members-title">Members {token && <span>({participants.length})</span>}</h2>
      {!token ? <p className="lobby-muted">Sign in to view lobby members.</p> : participants.length === 0 ? <p className="lobby-muted">No members found.</p> :
        <div className="lobby-avatar-row">{visibleMembers.map((member) => <button
          key={member.id} ref={(element) => { if (element) avatarRefs.current.set(member.id, element); else avatarRefs.current.delete(member.id) }}
          className={`lobby-avatar ${member.role === 'host' ? 'lobby-avatar-host' : ''}`} type="button"
          aria-label={`${member.username}, ${member.role === 'host' ? 'Host' : 'Member'}`}
          aria-expanded={selectedId === member.id} aria-controls={selectedId === member.id ? 'lobby-member-info' : undefined}
          onClick={() => setSelectedId((current) => current === member.id ? null : member.id)}>
          {initials(member.username)}{member.role === 'host' && <Crown className="lobby-avatar-crown" size={14} aria-hidden="true" />}
        </button>)}
          {participants.length > INITIAL_MEMBERS && <button className="lobby-member-more" type="button"
            aria-expanded={expanded} onClick={() => { setExpanded(!expanded); if (expanded) setSelectedId(null) }}>
            {expanded ? 'Show less' : `+${participants.length - INITIAL_MEMBERS}`}
          </button>}
        </div>}
      {selectedMember && <div id="lobby-member-info" className="lobby-member-info" role="region" aria-label="Member information">
        <div><strong>{selectedMember.username}</strong><p>{selectedMember.role === 'host' ? 'Host' : 'Member'}</p></div>
        <button type="button" aria-label="Close member information" onClick={() => { setSelectedId(null); avatarRefs.current.get(selectedId)?.focus() }}><X size={18} aria-hidden="true" /></button>
      </div>}
    </section>
    <LobbyChat key={`${lobbyId}:${user?.id ?? 'guest'}:${isJoined}`} lobbyId={lobbyId} token={token} isMember={isJoined} userId={user?.id} />
    {isJoined && !isHost && <div className="lobby-detail-actions"><button type="button" className="lobby-leave-toggle" onClick={handleLeave} disabled={isSubmitting}>{isSubmitting ? 'Leaving...' : 'Leave Lobby'}</button></div>}
  </div>
}

export default LobbyDetail
