import { useEffect, useRef, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { loadLobbyMessages, sendLobbyMessage } from '../api/lobbyChat.js'

export default function LobbyChat({ lobbyId, token, isMember, userId }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const historyRef = useRef(null)
  const reloadRef = useRef(null)

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
      controller = new AbortController()
      try {
        const result = await loadLobbyMessages(lobbyId, token, controller.signal)
        if (!Array.isArray(result)) throw new Error('Invalid Lobby Chat response.')
        if (active) { setMessages(result); setError('') }
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          if (err.status === 401 || err.status === 403 || err.status === 404) setMessages([])
          setError(err.message || 'Unable to load messages.')
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

  useEffect(() => {
    const history = historyRef.current
    if (history) history.scrollTop = history.scrollHeight
  }, [messages.length])

  async function handleSend(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!isMember || !content || sending) return
    setSending(true)
    try {
      const message = await sendLobbyMessage(lobbyId, token, content)
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      setDraft('')
      setError('')
      reloadRef.current?.()
    } catch (err) { setError(err.message || 'Unable to send message.') }
    finally { setSending(false) }
  }

  return <section className="lobby-chat" aria-labelledby="lobby-chat-title">
    <header><div className="lobby-chat-heading"><MessagesSquare size={20} aria-hidden="true" /><h2 id="lobby-chat-title">Lobby Chat</h2></div>
      <span className="lobby-invite-wrap"><button type="button" className="lobby-invite-button" disabled aria-describedby="lobby-invite-unavailable">Invite Friends</button>
        <span id="lobby-invite-unavailable">Coming soon</span></span></header>
    {!isMember ? <div className="lobby-chat-empty" role="status"><strong>Join this lobby to use Lobby Chat.</strong></div> : <>
      <div className="lobby-chat-history" ref={historyRef} role="log" aria-label="Lobby messages" aria-live="polite">
        {loading ? <p role="status">Loading messages...</p> : messages.length === 0 ? <p>No messages yet.</p> : messages.map((message) =>
          <article key={message.id} className={`lobby-chat-message ${message.sender.id === userId ? 'lobby-chat-message-own' : ''}`}>
            <strong>{message.sender.displayName || message.sender.username}</strong>
            <p>{message.content}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
          </article>)}
      </div>
      {error && <p className="lobby-chat-error" role="alert">{error}</p>}
      <form className="lobby-chat-composer" onSubmit={handleSend}><label className="sr-only" htmlFor="lobby-chat-message">Lobby message</label>
        <input id="lobby-chat-message" placeholder="Write a message" maxLength={2000} value={draft} disabled={sending} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending...' : 'Send'}</button></form>
    </>}
  </section>
}
