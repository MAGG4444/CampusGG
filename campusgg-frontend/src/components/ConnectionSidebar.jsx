import { MessageCircle, PanelRightClose } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useChat } from '../context/chatContext.js'
import { CURRENT_USER_ID } from '../data/chatData.js'
import ConversationSearch from './chat/ConversationSearch.jsx'
import ConversationList from './chat/ConversationList.jsx'
import ChatHeader from './chat/ChatHeader.jsx'
import ChatMessage from './chat/ChatMessage.jsx'
import ChatComposer from './chat/ChatComposer.jsx'
import '../pages/Chat.css'
import './ConnectionSidebar.css'

export default function ConnectionSidebar({ isOpen, onToggle }) {
  const ToggleIcon = isOpen ? PanelRightClose : MessageCircle
  const action = isOpen ? 'Close messages' : 'Open messages'
  const { pathname } = useLocation()
  const [search, setSearch] = useState('')
  const historyRef = useRef(null)
  const searchRef = useRef(null)
  const panelRef = useRef(null)
  const toggleRef = useRef(null)
  const { chatConversations, selectedConversationId, selectedConversation, messageDraft,
    setMessageDraft, selectConversation, sendMessage } = useChat()
  const unreadCount = chatConversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0)
  const filtered = chatConversations.filter((conversation) =>
    conversation.username.toLowerCase().includes(search.trim().toLowerCase()))
  const messageCount = selectedConversation?.messages.length ?? 0

  useEffect(() => {
    if (isOpen && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [isOpen, selectedConversationId, messageCount])

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
          {selectedConversation ? <>
            <ChatHeader conversation={selectedConversation} titleId="sidebar-conversation-title"
              onBack={backToConversations} />
            <div className="chat-history" ref={historyRef} role="log"
              aria-label={`Messages with ${selectedConversation.username}`} aria-live={pathname === '/chat' ? 'off' : 'polite'} aria-relevant="additions">
              {selectedConversation.messages.map((message) => <ChatMessage key={message.id}
                message={message} currentUserId={CURRENT_USER_ID} senderName={selectedConversation.username} />)}
            </div>
            <ChatComposer value={messageDraft} onChange={setMessageDraft} onSend={sendMessage}
              recipientName={selectedConversation.username} />
          </> : <>
            <ConversationSearch id="sidebar-conversation-search" inputRef={searchRef} value={search} onChange={setSearch} />
            <ConversationList conversations={filtered} selectedId={selectedConversationId}
              onSelect={selectConversation} hasSearchQuery={Boolean(search.trim())} />
          </>}
        </div>}
      </aside>
    </>
  )
}
