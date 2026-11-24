import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatContext } from './chatContext.js'
import { useAuth } from './useAuth.js'
import { getHistory, listConversations, postMessage, readMessages } from '../api/directMessages.js'
import { subscribeDirectMessages } from '../api/directMessageSocket.js'
import { useFriendPresence } from '../utils/useFriendPresence.js'

const POLL_MS = 4000
function mergeMessages(previous, current) {
  const unique = new Map(previous.map(item => [item.id, item]))
  for (const item of current) unique.set(item.id, item)
  return [...unique.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}
function SessionChat({ children, token, userId }) {
  const presence = useFriendPresence(token)
  const [chatConversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedId] = useState(null)
  const [newFriend, setNewFriend] = useState(null)
  const [history, setHistory] = useState({ id: null, items: [], nextBefore: null, loaded: false })
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [revision, setRevision] = useState(0)
  const active = useRef(true)
  const selected = useRef(null)
  const sendLock = useRef(false)
  const olderLock = useRef(false)
  const readPending = useRef(new Set())
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    if (!token) return undefined
    // Push notifications accelerate REST refreshes. Existing polling remains
    // active when the socket is disconnected or the proxy is unavailable.
    try { return subscribeDirectMessages(token, refresh) }
    catch { return undefined }
  }, [token, refresh])
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  useEffect(() => {
    if (!token) return undefined
    const controller = new AbortController()
    let timer
    async function poll() {
      try {
        const items = await listConversations(token, { signal: controller.signal })
        if (!controller.signal.aborted) { setConversations(items); setError('') }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || 'Could not load conversations')
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, POLL_MS)
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [token, revision])

  useEffect(() => {
    if (!token || !selectedConversationId) return undefined
    const controller = new AbortController()
    const id = selectedConversationId
    let timer
    async function poll() {
      try {
        const page = await getHistory(token, id, { signal: controller.signal })
        if (controller.signal.aborted || selected.current !== id) return
        setHistory(previous => {
          const same = previous.id === id && previous.loaded
          return { id, loaded: true, items: mergeMessages(same ? previous.items : [], page.items), nextBefore: same && previous.items.length > 50 ? previous.nextBefore : page.nextBefore }
        })
        setHistoryError('')
      } catch (err) {
        if (controller.signal.aborted || selected.current !== id) return
        if (err.status === 403 || err.status === 404) {
          setHistory({ id, items: [], loaded: false, nextBefore: null })
          setNewFriend(null); selected.current = null; setSelectedId(null); refresh()
        }
        setHistoryError(err.message || 'Could not load messages')
      } finally {
        if (!controller.signal.aborted && selected.current === id) timer = setTimeout(poll, POLL_MS)
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [token, selectedConversationId, revision, refresh])

  function selectConversation(id) {
    selected.current = id
    setSelectedId(id); setNewFriend(null); setHistoryError('')
    setHistory(previous => previous.id === id ? previous : { id, items: [], nextBefore: null, loaded: false })
  }
  function openConversation(person) {
    selectConversation(person.id)
    setNewFriend({ id: person.id, username: person.name || person.displayName || person.username, handle: person.username, details: { bio: person.bio }, messages: [], unreadCount: 0 })
  }
  const messageDraft = drafts[selectedConversationId] || ''
  function setMessageDraft(value) { if (selectedConversationId) setDrafts(previous => ({ ...previous, [selectedConversationId]: value })) }
  async function sendMessage(value) {
    const id = selected.current
    const content = value.trim()
    if (!token || !id || !content || content.length > 2000 || sendLock.current) return false
    sendLock.current = true; setSending(true); setHistoryError('')
    try {
      const result = await postMessage(token, id, content)
      if (!active.current) return false
      if (selected.current === id) setHistory(previous => ({ ...previous, id, items: mergeMessages(previous.id === id ? previous.items : [], [result]) }))
      setDrafts(previous => previous[id] === value ? { ...previous, [id]: '' } : previous)
      refresh(); return true
    } catch (err) {
      if (active.current && selected.current === id) setHistoryError(err.message || 'Could not send message')
      return false
    } finally { sendLock.current = false; if (active.current) setSending(false) }
  }
  const markRead = useCallback(async (id, ids) => {
    if (!token || selected.current !== id || !ids.length) return
    const fresh = [...new Set(ids)].filter(value => !readPending.current.has(value)).slice(0, 100)
    if (!fresh.length) return
    fresh.forEach(value => readPending.current.add(value))
    try {
      await readMessages(token, id, fresh)
      if (active.current) {
        setHistory(previous => previous.id !== id ? previous : { ...previous, items: previous.items.map(item => fresh.includes(item.id) ? { ...item, readAt: item.readAt || new Date().toISOString() } : item) })
        refresh()
      }
    } catch { /* Leave unread; subsequent visibility updates can retry. */ }
    finally { fresh.forEach(value => readPending.current.delete(value)) }
  }, [token, refresh])
  async function loadOlder() {
    const id = selected.current
    if (!token || !id || history.id !== id || !history.nextBefore || olderLock.current) return
    olderLock.current = true; setLoadingOlder(true)
    try {
      const page = await getHistory(token, id, { before: history.nextBefore })
      if (active.current && selected.current === id) setHistory(previous => ({ ...previous, items: mergeMessages(page.items, previous.items), nextBefore: page.nextBefore }))
    } catch (err) { if (active.current && selected.current === id) setHistoryError(err.message || 'Could not load older messages') }
    finally { olderLock.current = false; if (active.current) setLoadingOlder(false) }
  }
  const summary = chatConversations.find(item => item.id === selectedConversationId) || (newFriend?.id === selectedConversationId ? newFriend : null)
  const items = history.id === selectedConversationId ? history.items : []
  const selectedConversation = summary && { ...summary, online: presence.get(summary.id), messages: items, unreadMessageIds: items.filter(item => item.recipientId === userId && !item.readAt).map(item => item.id) }
  return <ChatContext.Provider value={{ chatConversations: chatConversations.map(item => ({ ...item, online: presence.get(item.id) })), presence, selectedConversationId, selectedConversation, messageDraft, setMessageDraft, selectConversation, openConversation, sendMessage, markRead, userId, error, historyError, sending, loadingOlder, loadOlder, hasOlder: history.id === selectedConversationId && Boolean(history.nextBefore), refresh }}>{children}</ChatContext.Provider>
}
export default function ChatProvider({ children }) {
  const { token, isAuthenticated, user } = useAuth()
  const session = isAuthenticated && token ? token : null
  return <SessionChat key={session || 'anonymous'} token={session} userId={user?.id}>{children}</SessionChat>
}
