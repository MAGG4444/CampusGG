import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Search, UserRoundPlus, UsersRound } from 'lucide-react'
import { getSuggestedUsers } from '../api/recommendations.js'
import { useAuth } from '../context/useAuth.js'
import { useChat } from '../context/chatContext.js'
import ConversationList from '../components/chat/ConversationList.jsx'
import ConnectionConversation from '../components/ConnectionConversation.jsx'
import FindFriends from '../components/FindFriends.jsx'
import FriendProfileDrawer from '../components/FriendProfileDrawer.jsx'
import FriendsIndex from '../components/FriendsIndex.jsx'
import { useWorkspaceNarrow } from '../utils/useWorkspaceNarrow.js'
import './Chat.css'

const tabs = [{ id: 'messages', label: 'Messages', icon: MessageCircle }, { id: 'friends', label: 'Friends', icon: UsersRound }]
const unavailableFriends = []

function RealConnection() {
  const { isAuthenticated, token, user } = useAuth()
  const { chatConversations, selectedConversationId, selectedConversation, selectConversation, messageDraft, setMessageDraft, sendMessage } = useChat()
  const [tab, setTab] = useState('messages')
  const [view, setView] = useState('list')
  const [recommendations, setRecommendations] = useState({ status: 'idle', items: [] })
  const [retry, setRetry] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileButtonRef = useRef(null)
  const [workspaceRef, narrow] = useWorkspaceNarrow()
  const closeProfile = useCallback(() => setProfileOpen(false), [])

  useEffect(() => {
    if (view !== 'discover' || !isAuthenticated || !token) return undefined
    const controller = new AbortController()
    getSuggestedUsers(token, { limit: 20, signal: controller.signal })
      .then(data => { if (!Array.isArray(data?.items) || data.items.some(item => !item?.user?.id || !item.user.username)) throw new Error('Invalid suggestions response'); if (!controller.signal.aborted) setRecommendations({ status: data.needsProfile ? 'profile' : 'ready', items: data.items }) })
      .catch(() => { if (!controller.signal.aborted) setRecommendations({ status: 'error', items: [] }) })
    return () => controller.abort()
  }, [view, token, isAuthenticated, retry])
  function openDiscovery() { setProfileOpen(false); setView('discover'); if (isAuthenticated && token) setRecommendations({ status: 'loading', items: [] }) }
  function switchTab(id) { setTab(id); if (view === 'discover') setView('list') }
  const people = recommendations.items.map(({ user: person, reasons }) => ({ id: person.id, name: person.displayName || person.username, username: person.username, game: person.game, bio: person.bio, experienceLevel: person.experienceLevel, reasons, suggested: true }))
  const showConversation = view === 'conversation' && selectedConversation
  const detailOpen = view === 'discover' || showConversation

  return <div className="chat-page page-enter"><h1 className="sr-only">Connection</h1><section ref={workspaceRef} className={`chat-workspace connection-workspace ${profileOpen && showConversation ? 'connection-profile-open' : ''}`} aria-label="Connection workspace">
    <aside className={`chat-sidebar ${detailOpen ? 'chat-sidebar-mobile-hidden' : ''}`}>
      <nav className="connection-tabs" aria-label="Connection sections" style={{ '--tab-index': tabs.findIndex(item => item.id === tab) }}>{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => switchTab(id)}><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}</nav>
      {tab === 'friends' && <div className="friends-search-row"><div className="friends-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search Friends" placeholder="Search Friends" disabled /></div><button type="button" className="connection-icon-button" aria-label="Find Friends" onClick={openDiscovery}><UserRoundPlus size={20} aria-hidden="true" /></button></div>}
      <div className={`connection-list-content${tab === 'friends' ? ' connection-friends-content' : ''}`} key={tab}>{tab === 'messages' ? <ConversationList conversations={chatConversations} selectedId={selectedConversationId} onSelect={id => { selectConversation(id); setProfileOpen(false); setView('conversation') }} /> : <FriendsIndex people={unavailableFriends} emptyMessage="Friends are not available yet." />}</div>
    </aside>
    <section className={`active-chat-panel connection-detail ${detailOpen ? '' : 'active-chat-panel-mobile-hidden'}`} aria-label="Connection details" inert={profileOpen && narrow}>
      {view === 'discover' ? <FindFriends people={people} status={!isAuthenticated || !token ? 'signin' : recommendations.status} onRetry={() => { setRecommendations({ status: 'loading', items: [] }); setRetry(value => value + 1) }} onBack={() => setView('list')} /> : showConversation ? <ConnectionConversation key={selectedConversation.id} conversation={selectedConversation} currentUserId={user?.id} draft={messageDraft} setDraft={setMessageDraft} sendMessage={sendMessage} onBack={() => { setProfileOpen(false); setView('list') }} onProfile={() => setProfileOpen(value => !value)} profileOpen={profileOpen} profileButtonRef={profileButtonRef} /> : <div className="chat-empty-state"><span className="chat-empty-icon"><UsersRound size={32} aria-hidden="true" /></span><h2>{tab === 'messages' ? 'Your conversations' : 'Your friends'}</h2><p>{tab === 'messages' ? 'Select a conversation to see your messages.' : 'Select a friend to start a conversation.'}</p></div>}
    </section>
    {showConversation && <FriendProfileDrawer open={profileOpen} onClose={closeProfile} returnFocusRef={profileButtonRef} narrow={narrow} person={{ name: selectedConversation.username, username: selectedConversation.handle, avatar: selectedConversation.avatar, online: selectedConversation.online, bio: selectedConversation.details?.bio, game: selectedConversation.details?.games, sharedLobby: selectedConversation.sharedLobby }} />}
  </section></div>
}
export default RealConnection
