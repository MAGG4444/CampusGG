import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Crown, Trash2, UserPlus, X } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useJoinedLobbies } from '../context/useJoinedLobbies.js'
import { myContentReturnTo } from '../utils/myContentNavigation.js'
import LobbyChat from '../components/LobbyChat.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'
import CurrentLobbyDialog from '../components/CurrentLobbyDialog.jsx'
import { attemptLobbyJoin } from '../utils/currentLobby.js'
import { useNotifications } from '../components/notifications/useNotifications.js'
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
  const { joinLobby, leaveLobby, deleteLobby, refreshLobbyMembers, refreshMemberships } = useJoinedLobbies()
  const { addNotification } = useNotifications()
  const [lobby, setLobby] = useState(null)
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [confirmationError, setConfirmationError] = useState('')
  const [conflictLobby, setConflictLobby] = useState(null)
  const requestRef = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const memberSectionRef = useRef(null)
  const avatarRefs = useRef(new Map())
  const currentRoleRef = useRef(null)
  const leavingRef = useRef(false)
  const joinRequestRef = useRef(null)
  useEffect(() => () => joinRequestRef.current?.abort(), [])

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
    if (!token || isLoading || loadError || !lobby) return undefined
    let active = true
    let timer
    currentRoleRef.current = participants.find((member) => member.id === user?.id)?.role ?? null
    async function sync() {
      try {
        const members = await refreshLobbyMembers(lobbyId)
        if (!active || leavingRef.current) return
        const role = members.find((member) => member.id === user?.id)?.role ?? null
        if (currentRoleRef.current === 'member' && role === 'host') {
          addNotification({ type: 'info', title: 'You are now the lobby host', message: 'The previous host left the lobby.' })
        }
        currentRoleRef.current = role
        setParticipants(members)
      } catch (error) {
        if (active && !leavingRef.current && error.status === 404) {
          addNotification({ type: 'warning', title: 'Lobby closed', message: 'This lobby is no longer available.' })
          navigate('/lobby', { replace: true })
          return
        }
      }
      if (active) timer = window.setTimeout(sync, 10000)
    }
    timer = window.setTimeout(sync, 10000)
    return () => { active = false; window.clearTimeout(timer) }
  // Initial participant state establishes the baseline; polling maintains it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId, token, user?.id, isLoading, loadError, lobby, refreshLobbyMembers, navigate, addNotification])

  useEffect(() => {
    if (!selectedId || confirmation) return undefined
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
  }, [selectedId, confirmation])

  const currentMembership = participants.find((member) => member.id === user?.id)
  const isJoined = Boolean(currentMembership)
  const isHost = currentMembership?.role === 'host'
  const isFull = lobby?.participantLimit != null && participants.length >= lobby.participantLimit
  const selectedMember = participants.find((member) => member.id === selectedId)
  const visibleMembers = expanded ? participants : participants.slice(0, INITIAL_MEMBERS)

  async function handleJoin() {
    if (!token) { navigate('/signin'); return }
    if (isFull || lobby.visibility !== 'public' || joinRequestRef.current) return
    setIsSubmitting(true)
    setFeedback('')
    const controller = new AbortController()
    joinRequestRef.current = controller
    try {
      const { current } = await attemptLobbyJoin({ lobby, lobbies: [lobby], refreshMemberships, joinLobby, signal: controller.signal })
      if (controller.signal.aborted) return
      if (current) {
        if (String(current.id) === String(lobby.id)) {
          const members = await refreshLobbyMembers(lobby.id, controller.signal)
          if (!controller.signal.aborted) setParticipants(members)
        }
        else setConflictLobby(current)
        return
      }
      const members = await refreshLobbyMembers(lobby.id, controller.signal)
      if (!controller.signal.aborted) setParticipants(members)
    } catch (error) {
      if (controller.signal.aborted) return
      setFeedback(error instanceof Error ? error.message : 'Unable to join lobby.')
    } finally {
      if (joinRequestRef.current === controller) joinRequestRef.current = null
      if (!controller.signal.aborted) setIsSubmitting(false)
    }
  }

  async function handleLeave() {
    if (requestRef.current) return
    requestRef.current = true
    setIsSubmitting(true)
    leavingRef.current = true
    setFeedback('')
    try {
      await leaveLobby(lobby.id)
      addNotification({ type: 'success', title: 'Left lobby', message: 'You have left the lobby.' })
      navigate(returnTo)
    } catch (error) {
      leavingRef.current = false
      setConfirmationError(error instanceof Error ? error.message : 'Unable to leave lobby.')
    } finally { requestRef.current = false; setIsSubmitting(false) }
  }

  async function handleDelete() {
    if (requestRef.current) return
    requestRef.current = true
    setIsSubmitting(true)
    leavingRef.current = true
    setFeedback('')
    try {
      await deleteLobby(lobby.id)
      addNotification({ type: 'success', title: 'Lobby deleted', message: 'The lobby has been deleted.' })
      navigate('/lobby', { replace: true })
    } catch (error) {
      leavingRef.current = false
      setConfirmationError(error instanceof Error ? error.message : 'Unable to delete lobby.')
    } finally { requestRef.current = false; setIsSubmitting(false) }
  }

  function openConfirmation(action) {
    setConfirmationError('')
    setConfirmation(action)
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
      <div className="lobby-title-row"><div><h1>{lobby.lobbyName}</h1></div>
        {isJoined ? <div className="lobby-header-actions"><span className="lobby-status-badge">{isHost ? 'Host' : 'Joined'}</span>
          <button type="button" className="lobby-leave-toggle" onClick={() => openConfirmation('leave')} disabled={isSubmitting}>{isSubmitting ? 'Processing...' : 'Leave Lobby'}</button></div> :
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
    <div className="lobby-detail-content">
    <section className="lobby-members" aria-labelledby="lobby-members-title" ref={memberSectionRef}>
      <div className="lobby-members-heading">
        <h2 id="lobby-members-title">Members {token && <span>({participants.length})</span>}</h2>
        <span className="lobby-invite-wrap"><button type="button" className="lobby-invite-button" disabled aria-describedby="lobby-invite-unavailable"><UserPlus size={15} aria-hidden="true" /> Invite Friends</button>
          <span id="lobby-invite-unavailable">Coming soon</span></span>
      </div>
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
    </div>
    {isHost && <div className="lobby-detail-actions"><button type="button" className="lobby-delete-button" onClick={() => openConfirmation('delete')} disabled={isSubmitting}><Trash2 size={17} aria-hidden="true" /> Delete Lobby</button></div>}
    {confirmation && <ConfirmationModal
      title={confirmation === 'delete' ? 'Delete Lobby?' : !isHost ? 'Leave Lobby?' : participants.length > 1 ? 'Transfer Host & Leave?' : 'Leave & Delete Lobby?'}
      message={confirmation === 'delete' ? 'This will permanently delete the lobby and its chat history for all members.' : !isHost ? 'You can join another lobby after leaving.' : participants.length > 1 ? 'Host ownership will transfer to the next eligible member.' : "You're the last member. Leaving will delete this lobby and its chat history."}
      confirmLabel={confirmation === 'delete' ? 'Delete Lobby' : !isHost ? 'Leave Lobby' : participants.length > 1 ? 'Transfer & Leave' : 'Leave & Delete'}
      destructive={confirmation === 'delete' || (isHost && participants.length <= 1)} busy={isSubmitting} error={confirmationError}
      onCancel={() => setConfirmation(null)} onConfirm={confirmation === 'delete' ? handleDelete : handleLeave} />}
    {conflictLobby && <CurrentLobbyDialog lobby={conflictLobby} onCancel={() => setConflictLobby(null)}
      onView={(id) => { setConflictLobby(null); navigate(`/lobby/${id}`) }} />}
  </div>
}

export default LobbyDetail
