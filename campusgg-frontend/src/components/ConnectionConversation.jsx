import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import ChatHeader from './chat/ChatHeader.jsx'
import ChatMessage from './chat/ChatMessage.jsx'
import ChatComposer from './chat/ChatComposer.jsx'
import { messageGroupPositions } from '../utils/messageGroups.js'

export default function ConnectionConversation({ conversation, currentUserId, draft, setDraft, sendMessage, onBack, onProfile, profileOpen, profileButtonRef, onReadMessages, sending, onLoadOlder, loadingOlder }) {
  const historyRef = useRef(null)
  const dividerRef = useRef(null)
  const previousRef = useRef(null)
  const nearBottomRef = useRef(true)
  const anchorRef = useRef(null)
  const [firstUnreadId] = useState(() => conversation.messages.find(message => conversation.unreadMessageIds?.includes(message.id) && message.senderId !== currentUserId)?.id || null)
  const unreadDividerId = conversation.unreadMessageIds?.length ? firstUnreadId : null
  const positions = messageGroupPositions(conversation.messages, unreadDividerId)

  function rememberPosition(history) {
    const top = history.getBoundingClientRect().top
    const node = [...(history.querySelectorAll?.('[data-message-id]') || [])].find(item => item.getBoundingClientRect().bottom > top)
    anchorRef.current = node ? { node, offset: node.getBoundingClientRect().top - top } : null
  }

  useLayoutEffect(() => {
    const history = historyRef.current
    if (!history) return
    const last = conversation.messages.at(-1)
    const previous = previousRef.current
    if (!previous) {
      if (firstUnreadId && dividerRef.current) {
        history.scrollTop += dividerRef.current.getBoundingClientRect().top - history.getBoundingClientRect().top - 16
      } else {
        history.scrollTop = history.scrollHeight
      }
      nearBottomRef.current = history.scrollHeight - history.clientHeight - history.scrollTop < 80
      rememberPosition(history)
    } else if (last && last.id !== previous.lastId && conversation.messages.length > previous.length) {
      if (last.senderId === currentUserId || nearBottomRef.current) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        history.scrollTo({ top: history.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
      }
    }
    previousRef.current = { length: conversation.messages.length, lastId: last?.id }
  }, [conversation.messages, currentUserId, firstUnreadId])

  useEffect(() => {
    const history = historyRef.current
    if (!history || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      const anchor = anchorRef.current
      if (!anchor || !anchor.node.isConnected) return
      const offset = anchor.node.getBoundingClientRect().top - history.getBoundingClientRect().top
      history.scrollTop += offset - anchor.offset
    })
    observer.observe(history)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const history = historyRef.current
    if (!history || !onReadMessages || !conversation.unreadMessageIds?.length || typeof IntersectionObserver === 'undefined') return undefined
    const unread = new Set(conversation.unreadMessageIds)
    const observer = new IntersectionObserver(entries => {
      if (document.visibilityState !== 'visible') return
      const visible = entries.filter(entry => entry.isIntersecting).map(entry => entry.target.dataset.messageId).filter(id => unread.has(id))
      if (visible.length) onReadMessages(conversation.id, visible)
    }, { root: history, threshold: 0.01 })
    const nodes = [...history.querySelectorAll('[data-message-id]')].filter(node => unread.has(node.dataset.messageId))
    const observe = () => { observer.disconnect(); nodes.forEach(node => observer.observe(node)) }
    const handleVisibility = () => { if (document.visibilityState === 'visible') observe() }
    observe()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => { document.removeEventListener('visibilitychange', handleVisibility); observer.disconnect() }
  }, [conversation.id, conversation.unreadMessageIds, onReadMessages])

  return <>
    <div className="connection-conversation-header"><ChatHeader conversation={conversation} onBack={onBack} />{onProfile && <button ref={profileButtonRef} type="button" className="connection-icon-button connection-profile-button" aria-label={`View ${conversation.username}'s profile`} aria-controls="connection-profile-drawer" aria-expanded={profileOpen} onClick={onProfile}><UserRound size={19} aria-hidden="true" /></button>}</div>
    <div className="chat-history" ref={historyRef} onScroll={event => { const node = event.currentTarget; nearBottomRef.current = node.scrollHeight - node.clientHeight - node.scrollTop < 80; rememberPosition(node) }} role="log" aria-label={`Messages with ${conversation.username}`} aria-live="polite" tabIndex={0}>
      {onLoadOlder && <button type="button" className="connection-back-link" disabled={loadingOlder} onClick={onLoadOlder}>{loadingOlder ? 'Loading…' : 'Load older messages'}</button>}
      {conversation.messages.length ? conversation.messages.map((message, index) => <div className={`chat-message-entry ${positions[index].startsGroup ? 'chat-message-group-start' : 'chat-message-group-continued'}`} key={message.id} data-message-id={message.id}>{message.id === unreadDividerId && <div className="chat-unread-divider" ref={dividerRef}>Unread Messages</div>}<ChatMessage message={message} currentUserId={currentUserId} senderName={conversation.username} showTimestamp={positions[index].endsGroup} /></div>) : <div className="chat-history-empty"><strong>No messages yet</strong><span>Send a message to start this conversation.</span></div>}
    </div>
    <ChatComposer value={draft} onChange={setDraft} onSend={sendMessage} sending={sending} recipientName={conversation.username} />
  </>
}
