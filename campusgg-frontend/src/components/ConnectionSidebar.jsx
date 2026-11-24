import { MessageCircle, PanelRightClose } from 'lucide-react'
import { useRef, useState } from 'react'
import { useChat } from '../context/chatContext.js'

import ConversationSearch from './chat/ConversationSearch.jsx'
import ConversationList from './chat/ConversationList.jsx'
import ConnectionConversation from './ConnectionConversation.jsx'
import '../pages/Chat.css'
import './ConnectionSidebar.css'

export default function ConnectionSidebar({ isOpen, onToggle }) {
  const ToggleIcon = isOpen ? PanelRightClose : MessageCircle
  const action = isOpen ? 'Close messages' : 'Open messages'
  const [search, setSearch] = useState('')
  const searchRef = useRef(null)
  const panelRef = useRef(null)
  const toggleRef = useRef(null)
  const { chatConversations, selectedConversationId, selectedConversation, messageDraft,
    setMessageDraft, selectConversation, sendMessage, userId, markRead, error, historyError, sending, hasOlder, loadOlder, loadingOlder } = useChat()
  const unreadCount = chatConversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0)
  const filtered = chatConversations.filter((conversation) =>
    conversation.username.toLowerCase().includes(search.trim().toLowerCase()))

  function toggleSidebar() {
    if (!isOpen) {
      onToggle()
      requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }))
    } else {
      onToggle()
      toggleRef.current?.focus({ preventScroll: true })
    }
  }

  function backToConversations() {
    selectConversation(null)
    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }))
  }

  return (
    <>
      <button
        className="connection-sidebar-toggle"
        ref={toggleRef}
        type="button"
        aria-controls="connection-sidebar"
        aria-expanded={isOpen}
        aria-label={action}
        aria-describedby={!isOpen && unreadCount > 0 ? 'sidebar-unread-count' : undefined}
        title={action}
        onClick={toggleSidebar}
      >
        <ToggleIcon size={18} strokeWidth={2.4} aria-hidden="true" />
        {!isOpen && unreadCount > 0 && <>
          <span className="connection-toggle-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
          <span id="sidebar-unread-count" className="sr-only">{unreadCount} unread messages</span>
        </>}
      </button>
      <aside
        className="connection-sidebar"
        id="connection-sidebar"
        aria-hidden={!isOpen}
        aria-label="Direct messages"
      >
        {isOpen && <div className="connection-chat" ref={panelRef} tabIndex={-1}>
          <header className="connection-sidebar-header">
            <MessageCircle size={20} strokeWidth={2} aria-hidden="true" />
            <h2>Messages</h2>
          </header>
          {(error || historyError) && <p role="alert">{historyError || error}</p>}
          {selectedConversation ? <ConnectionConversation key={selectedConversation.id} conversation={selectedConversation}
            currentUserId={userId} draft={messageDraft} setDraft={setMessageDraft} sendMessage={sendMessage}
            onReadMessages={markRead} sending={sending} onLoadOlder={hasOlder ? loadOlder : undefined} loadingOlder={loadingOlder}
            onBack={backToConversations} /> : <>
            <ConversationSearch id="sidebar-conversation-search" inputRef={searchRef} value={search} onChange={setSearch} />
            <ConversationList conversations={filtered} selectedId={selectedConversationId}
              onSelect={selectConversation} hasSearchQuery={Boolean(search.trim())} />
          </>}
        </div>}
      </aside>
    </>
  )
}
