import { useEffect, useMemo, useRef, useState } from 'react'
import ChatComposer from '../components/chat/ChatComposer.jsx'
import ChatEmptyState from '../components/chat/ChatEmptyState.jsx'
import ChatHeader from '../components/chat/ChatHeader.jsx'
import ChatMessage from '../components/chat/ChatMessage.jsx'
import ConversationList from '../components/chat/ConversationList.jsx'
import ConversationSearch from '../components/chat/ConversationSearch.jsx'
import { conversations } from '../data/chatData.js'
import './Chat.css'

function Chat() {
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const activePanelRef = useRef(null)
  const searchInputRef = useRef(null)

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) return conversations

    return conversations.filter((conversation) =>
      conversation.username.toLowerCase().includes(normalizedQuery),
    )
  }, [searchQuery])

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  )

  useEffect(() => {
    if (selectedConversation) {
      activePanelRef.current?.focus({ preventScroll: true })
    }
  }, [selectedConversation])

  function handleBackToConversations() {
    setSelectedConversationId(null)
    requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
  }

  return (
    <div className="chat-page page-enter">
      <div className="chat-page-heading">
        <div>
          <p className="page-kicker">Squad communications</p>
          <h1>Chat</h1>
        </div>
        <p>Keep plans, callouts, and campus connections in one place.</p>
      </div>

      <section className="chat-workspace" aria-label="CampusGG chat">
        <aside className={`chat-sidebar ${selectedConversation ? 'chat-sidebar-mobile-hidden' : ''}`}>
          <div className="chat-sidebar-header">
            <div>
              <h2>Conversations</h2>
              <span>{conversations.length} active threads</span>
            </div>
            <span className="chat-thread-count" aria-label={`${conversations.length} conversations`}>
              {conversations.length}
            </span>
          </div>
          <ConversationSearch value={searchQuery} onChange={setSearchQuery} inputRef={searchInputRef} />
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
            hasSearchQuery={searchQuery.trim().length > 0}
          />
        </aside>

        <section
          ref={activePanelRef}
          className={`active-chat-panel ${selectedConversation ? '' : 'active-chat-panel-mobile-hidden'}`}
          aria-labelledby={selectedConversation ? 'active-conversation-title' : undefined}
          tabIndex={selectedConversation ? -1 : undefined}
        >
          {selectedConversation ? (
            <>
              <ChatHeader conversation={selectedConversation} onBack={handleBackToConversations} />
              <div className="chat-history" aria-label={`Messages with ${selectedConversation.username}`}>
                <div className="chat-date-divider"><span>Today</span></div>
                {selectedConversation.messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    senderName={selectedConversation.username}
                  />
                ))}
              </div>
              <ChatComposer />
            </>
          ) : (
            <ChatEmptyState />
          )}
        </section>
      </section>
    </div>
  )
}

export default Chat
