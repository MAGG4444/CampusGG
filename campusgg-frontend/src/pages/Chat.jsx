import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, MessageCircle, Send, UserCheck, UserRoundPlus } from 'lucide-react'
import ChatComposer from '../components/chat/ChatComposer.jsx'
import ChatDetailsPanel from '../components/chat/ChatDetailsPanel.jsx'
import ChatEmptyState from '../components/chat/ChatEmptyState.jsx'
import ChatHeader from '../components/chat/ChatHeader.jsx'
import ChatMessage from '../components/chat/ChatMessage.jsx'
import ConversationList from '../components/chat/ConversationList.jsx'
import ConversationSearch from '../components/chat/ConversationSearch.jsx'
import { useNotifications } from '../components/notifications/useNotifications.js'
import { conversations as initialConversations, CURRENT_USER_ID } from '../data/chatData.js'
import './Chat.css'

function Chat() {
  const { addNotification } = useNotifications()
  const [chatConversations, setChatConversations] = useState(initialConversations)
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const activePanelRef = useRef(null)
  const chatHistoryRef = useRef(null)
  const detailsButtonRef = useRef(null)
  const detailsPanelRef = useRef(null)
  const previousConversationIdRef = useRef(null)
  const searchInputRef = useRef(null)
  const notifiedConversationIdsRef = useRef(new Set())

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
  const selectedMessageCount = selectedConversation?.messages.length ?? 0

  useEffect(() => {
    if (selectedConversationId) {
      activePanelRef.current?.focus({ preventScroll: true })
    }
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId || !chatHistoryRef.current) return

    const behavior = previousConversationIdRef.current === selectedConversationId ? 'smooth' : 'auto'
    const history = chatHistoryRef.current
    history.scrollTo({ top: history.scrollHeight, behavior })
    previousConversationIdRef.current = selectedConversationId
  }, [selectedConversationId, selectedMessageCount])

  useEffect(() => {
    if (detailsOpen) {
      detailsPanelRef.current?.focus({ preventScroll: true })
    }
  }, [detailsOpen])

  function handleSelectConversation(conversationId) {
    const conversation = chatConversations.find((item) => item.id === conversationId)

    if (
      conversation?.unreadCount > 0
      && !notifiedConversationIdsRef.current.has(conversationId)
    ) {
      notifiedConversationIdsRef.current.add(conversationId)
      addNotification({
        type: 'info',
        title: `New messages from ${conversation.username}`,
        message: conversation.lastMessage,
        icon: MessageCircle,
        duration: 5000,
      })
    }

    setDetailsOpen(false)
    setMessageDraft('')
    setSelectedConversationId(conversationId)
  }

  function handleBackToConversations() {
    setDetailsOpen(false)
    setMessageDraft('')
    setSelectedConversationId(null)
    requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
  }

  function handleCloseDetails() {
    setDetailsOpen(false)
    requestAnimationFrame(() => detailsButtonRef.current?.focus({ preventScroll: true }))
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
    addNotification({
      type: 'success',
      title: 'Message sent',
      message: `Your message to ${selectedConversation.username} was added to this conversation.`,
      icon: Send,
      duration: 4000,
    })
    return true
  }

  function handleConnectionFeedback(conversation) {
    const status = conversation.details?.connectionStatus
    const feedbackByStatus = {
      Connected: {
        type: 'info',
        title: 'Already connected',
        message: `You and ${conversation.username} are already connected on CampusGG.`,
        icon: UserCheck,
      },
      Pending: {
        type: 'warning',
        title: 'Connection pending',
        message: `The local profile marks your connection with ${conversation.username} as pending.`,
        icon: Clock3,
      },
      'Not connected': {
        type: 'error',
        title: 'Connection unavailable',
        message: 'Connection requests are not available in this frontend-only preview.',
        icon: UserRoundPlus,
      },
    }

    addNotification(feedbackByStatus[status] || {
      type: 'info',
      title: 'Connection status unavailable',
      message: 'No connection information is available for this conversation.',
    })
  }

  return (
    <div className={`chat-page page-enter ${selectedConversation ? 'chat-page-conversation-active' : ''}`}>
      <div className="chat-page-heading">
        <div>
          <p className="page-kicker">Squad communications</p>
          <h1>Chat</h1>
        </div>
        <p>Keep plans, callouts, and campus connections in one place.</p>
      </div>

      <section
        className={`chat-workspace ${detailsOpen ? 'chat-workspace-details-open' : ''}`}
        aria-label="CampusGG chat"
      >
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
              <ChatHeader
                conversation={selectedConversation}
                onBack={handleBackToConversations}
                onOpenDetails={() => setDetailsOpen(true)}
                detailsOpen={detailsOpen}
                detailsButtonRef={detailsButtonRef}
              />
              <div
                ref={chatHistoryRef}
                className="chat-history"
                role="log"
                aria-label={`Messages with ${selectedConversation.username}`}
                aria-live="polite"
                aria-relevant="additions"
              >
                <div className="chat-date-divider"><span>Today</span></div>
                {selectedConversation.messages.length > 0 ? (
                  selectedConversation.messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      currentUserId={CURRENT_USER_ID}
                      senderName={selectedConversation.username}
                    />
                  ))
                ) : (
                  <div className="chat-history-empty" role="status">
                    <MessageCircle size={28} strokeWidth={1.8} aria-hidden="true" />
                    <strong>No messages yet</strong>
                    <span>Send a message to start this conversation.</span>
                  </div>
                )}
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
        {selectedConversation && detailsOpen ? (
          <ChatDetailsPanel
            conversation={selectedConversation}
            onClose={handleCloseDetails}
            onConnectionFeedback={handleConnectionFeedback}
            panelRef={detailsPanelRef}
          />
        ) : null}
      </section>
    </div>
  )
}

export default Chat
