import { useCallback, useEffect, useRef, useState } from 'react'
import { request } from '../api/request.js'
import { ForumFollowsContext } from './forumFollowsContext.js'

export default function ForumFollowsProvider({ token, children }) {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState({})
  const [version, setVersion] = useState(0)
  const [retry, setRetry] = useState(0)
  const active = useRef(true)
  const pending = useRef(new Set())
  useEffect(() => {
    active.current = true
    const controller = new AbortController()
    if (token) request('/forum/me/channels', { token, signal: controller.signal })
      .then((data) => { if (!Array.isArray(data)) throw new Error('Invalid subscription response'); if (!controller.signal.aborted) { setChannels(data); setError(''); setLoading(false) } })
      .catch(() => { if (!controller.signal.aborted) { setError('Unable to load followed channels.'); setLoading(false) } })
    return () => { active.current = false; controller.abort() }
  }, [token, retry])
  const refresh = useCallback(() => { setError(''); setLoading(true); setRetry((value) => value + 1) }, [])
  const toggle = useCallback(async (channel, following) => {
    if (!token || pending.current.has(channel.id)) return
    pending.current.add(channel.id)
    setBusy((current) => ({ ...current, [channel.id]: true }))
    setError('')
    try {
      const result = await request(`/forum/channels/${encodeURIComponent(channel.slug)}/follow`, { token, method: following ? 'DELETE' : 'POST' })
      if (typeof result?.following !== 'boolean') throw new Error('Invalid subscription response')
      if (active.current) {
        setChannels((current) => result.following ? [...current.filter((item) => item.id !== channel.id), channel].sort((a, b) => a.name.localeCompare(b.name)) : current.filter((item) => item.id !== channel.id))
        setVersion((value) => value + 1)
      }
    } catch (err) {
      if (active.current) setError(err.message || 'Unable to update subscription.')
    } finally {
      pending.current.delete(channel.id)
      if (active.current) setBusy((current) => ({ ...current, [channel.id]: false }))
    }
  }, [token])
  return <ForumFollowsContext.Provider value={{ token, channels, loading, error, busy, version, toggle, refresh }}>{children}</ForumFollowsContext.Provider>
}
