import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, MessagesSquare } from 'lucide-react'
import { loadLobbyMessages, loadLobbyReadState, markLobbyMessageRead, sendLobbyMessage } from '../api/lobbyChat.js'
import { isGroupedMessage, isNearBottom, newMessageIds, shouldSendOnKey, uniqueMessages } from '../utils/lobbyChatView.js'

export default function LobbyChat({ lobbyId, token, isMember, userId }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [sendError, setSendError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [unreadIds, setUnreadIds] = useState([])
  const [boundaryId, setBoundaryId] = useState(null)
  const [jumped, setJumped] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const historyRef = useRef(null)
  const reloadRef = useRef(null)
  const textareaRef = useRef(null)
  const composingRef = useRef(false)
  const sendingRef = useRef(false)
  const nearBottomRef = useRef(true)
  const initializedRef = useRef(false)
  const knownIdsRef = useRef(new Set())
  const unreadRef = useRef([])
  const viewedRef = useRef(new Set())
  const reviewingRef = useRef(false)
  const scrollIntentRef = useRef(0)
  const markingRef = useRef(false)
  const scrollAfterRenderRef = useRef(false)
  const sentVersionRef = useRef(0)

  function receiveMessages(result, hadUnread) {
    const ids = newMessageIds(knownIdsRef.current, result)
    if (!initializedRef.current || (ids.length > 0 && nearBottomRef.current && !hadUnread)) {
      if (!reviewingRef.current && nearBottomRef.current) scrollAfterRenderRef.current = true
    }
    initializedRef.current = true
    result.forEach((message) => knownIdsRef.current.add(message.id))
    setMessages(result)
  }

  useEffect(() => {
    if (!isMember || !token) return undefined
    let active = true
    let pending = false
    let refreshAgain = false
    let timer
    let controller
    async function refresh() {
      if (!active) return
      if (pending) { refreshAgain = true; return }
      window.clearTimeout(timer)
      pending = true
      const version = sentVersionRef.current
      controller = new AbortController()
      try {
        const [result, readState] = await Promise.all([
          loadLobbyMessages(lobbyId, token, controller.signal),
          loadLobbyReadState(lobbyId, token, controller.signal),
        ])
        if (!Array.isArray(result)) throw new Error('Invalid Lobby Chat response.')
        if (!Array.isArray(readState.unreadMessageIds)) throw new Error('Invalid unread state.')
        if (active && version === sentVersionRef.current) {
          const hadUnread = unreadRef.current.length > 0
          if (!markingRef.current) {
            unreadRef.current = readState.unreadMessageIds
            setUnreadIds(readState.unreadMessageIds)
            setBoundaryId((current) => current || readState.unreadMessageIds[0] || null)
          }
          receiveMessages(uniqueMessages(result), hadUnread); setRefreshError('')
        }
        else if (active) refreshAgain = true
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          if (err.status === 401 || err.status === 403 || err.status === 404) setMessages([])
          setRefreshError(err.message || 'Unable to load messages.')
        }
      } finally {
        pending = false
        if (active) {
          setLoading(false)
          timer = window.setTimeout(refresh, refreshAgain ? 0 : 10000)
          refreshAgain = false
        }
      }
    }
    reloadRef.current = refresh
    refresh()
    return () => { active = false; reloadRef.current = null; window.clearTimeout(timer); controller?.abort() }
  }, [lobbyId, token, isMember])

  useLayoutEffect(() => {
    const history = historyRef.current
    if (history && scrollAfterRenderRef.current) {
      history.scrollTop = history.scrollHeight
      scrollAfterRenderRef.current = false
      nearBottomRef.current = true
    }
  }, [messages, loading])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`
  }, [draft])

  function handleScroll() {
    const near = isNearBottom(historyRef.current)
    nearBottomRef.current = near
    if (unreadRef.current.length && scrollIntentRef.current && Date.now() - scrollIntentRef.current < 1000) {
      scrollIntentRef.current = 0
      reviewingRef.current = true
      setReviewing(true)
    }
  }

  function jumpToUnread() {
    const history = historyRef.current
    const first = history?.querySelector('[data-unread-first="true"]')
    if (!history || !first) return
    reviewingRef.current = true
    setReviewing(true)
    setJumped(true)
    history.scrollTo({ top: first.offsetTop - history.offsetTop, behavior: 'auto' })
  }

  useEffect(() => {
    const history = historyRef.current
    if (!history || !unreadIds.length || !reviewing) return undefined
    let active = true
    async function persistViewed() {
      if (markingRef.current) return
      let lastViewed = null
      for (const id of unreadRef.current) {
        if (!viewedRef.current.has(id)) break
        lastViewed = id
      }
      if (!lastViewed) return
      markingRef.current = true
      try {
        await markLobbyMessageRead(lobbyId, token, lastViewed)
        if (!active) return
        const index = unreadRef.current.indexOf(lastViewed)
        unreadRef.current = unreadRef.current.slice(index + 1)
        setUnreadIds(unreadRef.current)
        if (!unreadRef.current.length) { setBoundaryId(null); setJumped(false); reviewingRef.current = false; setReviewing(false); viewedRef.current.clear() }
        setRefreshError('')
      } catch (error) { if (active) setRefreshError(error.message || 'Unable to save read position.') }
      finally { markingRef.current = false }
    }
    const observer = new IntersectionObserver((entries) => {
      if (!reviewingRef.current || document.visibilityState !== 'visible') return
      entries.forEach((entry) => {
        if (entry.isIntersecting) viewedRef.current.add(entry.target.dataset.messageId)
      })
      void persistViewed()
    }, { root: history, threshold: 0 })
    history.querySelectorAll('[data-message-id]').forEach((element) => observer.observe(element))
    return () => { active = false; observer.disconnect() }
  }, [messages, unreadIds, reviewing, lobbyId, token])

  async function handleSend(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!isMember || !content || sendingRef.current || composingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSendError('')
    try {
      const message = await sendLobbyMessage(lobbyId, token, content)
      sentVersionRef.current += 1
      knownIdsRef.current.add(message.id)
      if (!reviewingRef.current && nearBottomRef.current) scrollAfterRenderRef.current = true
      setMessages((current) => current.some((item) => item.id === message.id) ? [...current] : [...current, message])
      setDraft('')
      reloadRef.current?.()
    } catch (err) { setSendError(err.message || 'Unable to send message. Please try again.') }
    finally { sendingRef.current = false; setSending(false) }
  }

  return <section className="lobby-chat" aria-labelledby="lobby-chat-title">
    <header><div className="lobby-chat-heading"><MessagesSquare size={20} aria-hidden="true" /><h2 id="lobby-chat-title">Lobby Chat</h2></div></header>
    {!isMember ? <div className="lobby-chat-empty" role="status"><strong>Join this lobby to use Lobby Chat.</strong></div> : <>
      <div className="lobby-chat-history-wrap">
      <div className="lobby-chat-history" ref={historyRef} onScroll={handleScroll}
        onWheel={() => { scrollIntentRef.current = Date.now() }}
        onTouchMove={() => { scrollIntentRef.current = Date.now() }}
        onPointerDown={() => { scrollIntentRef.current = Date.now() }}
        onKeyDown={(event) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) scrollIntentRef.current = Date.now() }}
        tabIndex={0} role="log" aria-label="Lobby messages" aria-live="polite">
        {loading ? <p role="status">Loading messages...</p> : messages.length === 0 ? <p>No messages yet.</p> : messages.map((message, index) => {
          const grouped = isGroupedMessage(messages[index - 1], message)
          const name = message.sender.displayName || message.sender.username
          const fullTime = new Date(message.createdAt).toLocaleString()
          const shortTime = new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          return <div key={message.id} className={`lobby-chat-message-row ${message.sender.id === userId ? 'lobby-chat-message-row-own' : ''}`} data-message-id={message.id} data-unread-first={message.id === boundaryId ? 'true' : undefined}>
            {message.id === boundaryId && <div className="lobby-chat-unread-separator">New messages</div>}
            <article className={`lobby-chat-message ${message.sender.id === userId ? 'lobby-chat-message-own' : ''} ${grouped && message.id !== boundaryId ? 'lobby-chat-message-grouped' : ''}`}>
            {grouped ? <span className="sr-only">{name}, {fullTime}</span> : <><strong>{name}</strong><time dateTime={message.createdAt} title={fullTime}>{shortTime}</time></>}
            <p>{message.content}</p>
          </article></div>
        })}
      </div>
      {unreadIds.length > 0 && !jumped && <button type="button" className="lobby-chat-unread" onClick={jumpToUnread} aria-label={`Jump to first unread message, ${unreadIds.length} unread`}>
        <ArrowUp size={17} aria-hidden="true" /><span>{unreadIds.length} unread</span>
      </button>}
      </div>
      {refreshError && <p className="lobby-chat-error" role="alert">{refreshError}</p>}
      {sendError && <p className="lobby-chat-error" role="alert">{sendError}</p>}
      <form className="lobby-chat-composer" onSubmit={handleSend}><label className="sr-only" htmlFor="lobby-chat-message">Lobby message</label>
        <textarea ref={textareaRef} id="lobby-chat-message" placeholder="Write a message" rows={1} maxLength={2000} value={draft} disabled={sending}
          onChange={(event) => setDraft(event.target.value)} onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }} onKeyDown={(event) => {
            if (shouldSendOnKey(event.nativeEvent) && !composingRef.current) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
          }} />
        <button type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending...' : 'Send'}</button></form>
    </>}
  </section>
}
