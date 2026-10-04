import { useEffect, useMemo, useRef, useState } from 'react'
import ChatComposer from '../components/chat/ChatComposer.jsx'
import ChatEmptyState from '../components/chat/ChatEmptyState.jsx'
import ChatHeader from '../components/chat/ChatHeader.jsx'
import ChatMessage from '../components/chat/ChatMessage.jsx'
import ConversationList from '../components/chat/ConversationList.jsx'
import ConversationSearch from '../components/chat/ConversationSearch.jsx'
import { conversations as initialConversations, CURRENT_USER_ID } from '../data/chatData.js'
import './Chat.css'

function Chat() {
  const [chatConversations, setChatConversations] = useState(initialConversations)
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const activePanelRef = useRef(null)
  const chatHistoryRef = useRef(null)
  const previousConversationIdRef = useRef(null)
  const searchInputRef = useRef(null)

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) return chatConversations

    return chatConversations.filter((conversation) =>
      conversation.username.toLowerCase().includes(normalizedQuery),
    )
  }, [chatConversations, searchQuery])

  const selectedConversation = chatConversations.find(
    (conversation) => conversation.id === selectedConversationId,
  )

  useEffect(() => {
    if (selectedConversation) {
      activePanelRef.current?.focus({ preventScroll: true })
    }
  }, [selectedConversation])

  useEffect(() => {
    if (!selectedConversation || !chatHistoryRef.current) return

    const behavior = previousConversationIdRef.current === selectedConversation.id ? 'smooth' : 'auto'
    const history = chatHistoryRef.current
    history.scrollTo({ top: history.scrollHeight, behavior })
    previousConversationIdRef.current = selectedConversation.id
  }, [selectedConversation, selectedConversation?.messages.length])

  function handleSelectConversation(conversationId) {
    setMessageDraft('')
    setSelectedConversationId(conversationId)
  }

  function handleBackToConversations() {
    setMessageDraft('')
    setSelectedConversationId(null)
    requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
  }

  function handleSendMessage(messageText) {
    const trimmedMessage = messageText.trim()

    if (!selectedConversationId || !trimmedMessage) return false

    const timestamp = new Intl.DateTimeFormat([], {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date())
    const newMessage = {
      id: `${selectedConversationId}-${Date.now()}`,
      senderId: CURRENT_USER_ID,
      text: trimmedMessage,
      timestamp,
    }

    setChatConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              lastMessage: trimmedMessage,
              timestamp: 'Now',
              messages: [...conversation.messages, newMessage],
            }
          : conversation,
      ),
    )
    setMessageDraft('')
    return true
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
              <span>{chatConversations.length} active threads</span>
            </div>
            <span className="chat-thread-count" aria-label={`${chatConversations.length} conversations`}>
              {chatConversations.length}
            </span>
          </div>
          <ConversationSearch value={searchQuery} onChange={setSearchQuery} inputRef={searchInputRef} />
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
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
              <div
                ref={chatHistoryRef}
                className="chat-history"
                role="log"
                aria-label={`Messages with ${selectedConversation.username}`}
                aria-live="polite"
                aria-relevant="additions"
              >
                <div className="chat-date-divider"><span>Today</span></div>
                {selectedConversation.messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    currentUserId={CURRENT_USER_ID}
                    senderName={selectedConversation.username}
                  />
                ))}
              </div>
              <ChatComposer
                value={messageDraft}
                onChange={setMessageDraft}
                onSend={handleSendMessage}
                recipientName={selectedConversation.username}
              />
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
