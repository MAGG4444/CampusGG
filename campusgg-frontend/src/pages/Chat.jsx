import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Search, UserRoundPlus, UsersRound } from 'lucide-react'
import { getSuggestedUsers } from '../api/recommendations.js'
import { useAuth } from '../context/useAuth.js'
import { useConnections } from '../utils/useConnections.js'
import { useRecentPlayers } from '../utils/useRecentPlayers.js'
import ChatAvatar from '../components/chat/ChatAvatar.jsx'
import { useChat } from '../context/chatContext.js'
import ConversationList from '../components/chat/ConversationList.jsx'
import ConnectionConversation from '../components/ConnectionConversation.jsx'
import FindFriends from '../components/FindFriends.jsx'
import FriendProfileDrawer from '../components/FriendProfileDrawer.jsx'
import FriendsIndex from '../components/FriendsIndex.jsx'
import { useWorkspaceNarrow } from '../utils/useWorkspaceNarrow.js'
import './Chat.css'

const tabs = [{ id: 'messages', label: 'Messages', icon: MessageCircle }, { id: 'friends', label: 'Friends', icon: UsersRound }]

function RealConnection() {
  const { isAuthenticated, token, user } = useAuth()
  const { chatConversations, selectedConversationId, selectedConversation, selectConversation, messageDraft, setMessageDraft, sendMessage, openConversation, markRead, error: chatError, historyError, sending, loadOlder, hasOlder, loadingOlder  , presence } = useChat()
  const [tab, setTab] = useState('messages')
  const [view, setView] = useState('list')
  const [friendQuery, setFriendQuery] = useState('')
  const [playerQuery, setPlayerQuery] = useState('')
  const [selectedFriendId, setSelectedFriendId] = useState(null)
  const connections = useConnections(token, isAuthenticated && (tab === 'friends' || view === 'discover'), view === 'discover' ? playerQuery : '')
  const ready = connections.status === 'ready'
  const recent = useRecentPlayers(isAuthenticated ? token : null, view === 'discover')
  const selectedFriend = connections.friends.find(person => person.id === selectedFriendId)
  const filteredFriends = connections.friends.filter(person => `${person.name} ${person.username}`.toLowerCase().includes(friendQuery.trim().toLowerCase()))
  const relationships = new Map([...connections.friends, ...connections.incoming, ...connections.outgoing].map(person => [person.id, person.relationship]))
  const action = ready && !connections.busy ? connections.act : undefined
  const recentPeople = recent.items.map(person => {
    const relationship = ready ? relationships.get(person.id) || 'none' : undefined
    return { ...person, relationship, online: relationship === 'friend' ? presence?.get(person.id) : undefined }
  })
  function refreshDiscovery() { connections.refresh(); recent.refresh() }
  async function removeFriend(person) {
    if (await connections.act(person, 'remove')) { setSelectedFriendId(null); setView('list') }
  }
  const [recommendations, setRecommendations] = useState({ status: 'idle', items: [] })
  const [selectedGame, setSelectedGame] = useState('')
  const viewerGames = useMemo(() => [...new Set((user?.gamingProfiles ?? []).map(profile => profile.game).filter(Boolean))], [user?.gamingProfiles])
  const activeGame = viewerGames.includes(selectedGame) ? selectedGame : viewerGames[0] ?? ''
  const [retry, setRetry] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileButtonRef = useRef(null)
  const [workspaceRef, narrow] = useWorkspaceNarrow()
  const closeProfile = useCallback(() => setProfileOpen(false), [])

  useEffect(() => {
    if (view !== 'discover' || !isAuthenticated || !token) return undefined
    const controller = new AbortController()
    getSuggestedUsers(token, { game: activeGame || undefined, limit: 20, signal: controller.signal })
      .then(data => { if (!Array.isArray(data?.items) || data.items.some(item => !item?.user?.id || !item.user.username)) throw new Error('Invalid suggestions response'); if (!controller.signal.aborted) setRecommendations({ status: data.needsProfile ? 'profile' : 'ready', items: data.items, game: data.game ?? activeGame ?? null }) })
      .catch(() => { if (!controller.signal.aborted) setRecommendations({ status: 'error', items: [] }) })
    return () => controller.abort()
  }, [view, token, isAuthenticated, activeGame, retry])
  function messageFriend(person) { openConversation?.(person); setTab('messages'); setProfileOpen(false); setView('conversation') }
  function changeGame(game) { setSelectedGame(game); if (view === 'discover') setRecommendations({ status: 'loading', items: [] }) }
  function openDiscovery() { setProfileOpen(false); setPlayerQuery(''); setView('discover'); connections.refresh(); if (isAuthenticated && token) setRecommendations({ status: 'loading', items: [] }) }
  function switchTab(id) { setTab(id); if (view === 'discover' || view === 'friend') setView('list'); if (id === 'friends') connections.refresh() }
  const people = recommendations.items.map(({ user: person, reasons }) => ({ id: person.id, name: person.displayName || person.username, username: person.username, game: person.game, bio: person.bio, experienceLevel: person.experienceLevel, reasons, suggested: true, relationship: ready ? relationships.get(person.id) || 'none' : undefined }))
  const showConversation = view === 'conversation' && selectedConversation
  const detailOpen = view === 'discover' || view === 'friend' || showConversation

  return <div className="chat-page page-enter"><h1 className="sr-only">Connection</h1><section ref={workspaceRef} className={`chat-workspace connection-workspace ${profileOpen && showConversation ? 'connection-profile-open' : ''}`} aria-label="Connection workspace">
    <aside className={`chat-sidebar ${detailOpen ? 'chat-sidebar-mobile-hidden' : ''}`}>
      <nav className="connection-tabs" aria-label="Connection sections" style={{ '--tab-index': tabs.findIndex(item => item.id === tab) }}>{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => switchTab(id)}><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}</nav>
      {tab === 'friends' && <div className="friends-search-row"><div className="friends-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search Friends" placeholder="Search Friends" value={friendQuery} onChange={event => setFriendQuery(event.target.value)} disabled={!ready} /></div><button type="button" className="connection-icon-button" aria-label="Find Friends" onClick={openDiscovery}><UserRoundPlus size={20} aria-hidden="true" /></button></div>}
      <div className={`connection-list-content${tab === 'friends' ? ' connection-friends-content' : ''}`} key={tab}>{tab === 'messages' ? <ConversationList conversations={chatConversations} selectedId={selectedConversationId} onSelect={id => { selectConversation(id); setProfileOpen(false); setView('conversation') }} /> : <><div className="connection-actions"><button type="button" disabled={!isAuthenticated || connections.busy} onClick={connections.refresh}>Refresh Friends</button></div>{connections.status === 'error' && <p role="alert">Could not load friends.</p>}<FriendsIndex people={ready ? filteredFriends : []} emptyMessage={!isAuthenticated ? 'Sign in to see friends.' : connections.status === 'error' ? 'Friends could not be loaded.' : !ready ? 'Loading friends…' : friendQuery ? 'No matching friends.' : 'No friends yet.'} renderFriend={person => <li key={person.id} className="find-friends-row"><button type="button" className="find-friends-person" onClick={() => { setSelectedFriendId(person.id); setView('friend'); setProfileOpen(false) }}><ChatAvatar name={person.name} online={presence?.get(person.id)} /><span><strong>{person.name}</strong><small>@{person.username}{typeof presence?.get(person.id) === 'boolean' ? (presence.get(person.id) ? ' · Online' : ' · Offline') : ''}</small></span></button></li>} /></>}</div>
    </aside>
    <section className={`active-chat-panel connection-detail ${detailOpen ? '' : 'active-chat-panel-mobile-hidden'}`} aria-label="Connection details" inert={profileOpen && narrow}>
      {chatError && <p role="alert">{chatError}</p>}
      {historyError && <p role="alert">{historyError}</p>}
      {connections.error && <p role="alert">{connections.error}</p>}
      {view === 'friend' ? <div className="find-friends"><header className="find-friends-header"><button type="button" className="connection-back-link" onClick={() => setView('list')}>Back to friends</button><h2>Friend Profile</h2></header><div className="find-friends-body">{selectedFriend ? <section className="find-friends-profile"><ChatAvatar name={selectedFriend.name} online={presence?.get(selectedFriend.id)} size="profile" /><h3>{selectedFriend.name}</h3><p>@{selectedFriend.username}</p>{typeof presence?.get(selectedFriend.id) === 'boolean' && <p className="friend-profile-status">{presence.get(selectedFriend.id) ? 'Online' : 'Offline'}</p>}<p>{selectedFriend.bio || 'No bio yet.'}</p><p>{selectedFriend.game || 'No favorite game set.'}</p><div className="connection-actions"><button type="button" disabled={!action} onClick={() => removeFriend(selectedFriend)}>Remove Friend</button></div><div className="connection-actions"><button type="button" disabled={!openConversation} onClick={() => messageFriend(selectedFriend)}>Message</button></div></section> : <p>{ready ? 'This friendship is no longer available.' : 'Loading friend profile…'}</p>}</div></div> : view === 'discover' ? <FindFriends people={people} recentPeople={recentPeople} recentStatus={recent.status} onRecentRetry={recent.refresh} incoming={ready ? connections.incoming : null} outgoing={ready ? connections.outgoing : null} onAction={action} onMessage={openConversation ? messageFriend : undefined} playerQuery={playerQuery} onPlayerQuery={isAuthenticated && token ? setPlayerQuery : undefined} searchStatus={connections.search.status} searchPeople={connections.search.items.map(person => ({ ...person, relationship: ready ? relationships.get(person.id) || 'none' : undefined }))} onRefresh={refreshDiscovery} connectionsStatus={connections.status} status={!isAuthenticated || !token ? 'signin' : recommendations.status} games={viewerGames} selectedGame={activeGame} missingGame={recommendations.game ?? null} onGameChange={changeGame} onRetry={() => { setRecommendations({ status: 'loading', items: [] }); setRetry(value => value + 1) }} onBack={() => setView('list')} /> : showConversation ? <ConnectionConversation key={selectedConversation.id} conversation={selectedConversation} currentUserId={user?.id} draft={messageDraft} setDraft={setMessageDraft} sendMessage={sendMessage} onReadMessages={markRead} sending={sending} onLoadOlder={hasOlder ? loadOlder : undefined} loadingOlder={loadingOlder} onBack={() => { setProfileOpen(false); setView('list') }} onProfile={() => setProfileOpen(value => !value)} profileOpen={profileOpen} profileButtonRef={profileButtonRef} /> : <div className="chat-empty-state"><span className="chat-empty-icon"><UsersRound size={32} aria-hidden="true" /></span><h2>{tab === 'messages' ? 'Your conversations' : 'Your friends'}</h2><p>{tab === 'messages' ? 'Select a conversation to see your messages.' : 'Select a friend to start a conversation.'}</p></div>}
    </section>
    {showConversation && <FriendProfileDrawer open={profileOpen} onClose={closeProfile} returnFocusRef={profileButtonRef} narrow={narrow} person={{ name: selectedConversation.username, username: selectedConversation.handle, avatar: selectedConversation.avatar, online: selectedConversation.online, bio: selectedConversation.details?.bio, game: selectedConversation.details?.games, sharedLobby: selectedConversation.sharedLobby }} />}
  </section></div>
}
export default function Chat() {
  const { token, isAuthenticated } = useAuth()
  return <RealConnection key={isAuthenticated ? token || 'anonymous' : 'anonymous'} />
}
