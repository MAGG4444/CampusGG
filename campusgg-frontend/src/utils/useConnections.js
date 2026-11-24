import { useCallback, useEffect, useRef, useState } from 'react'
import { changeConnection, getConnections, searchPlayers } from '../api/connections.js'

const empty = { friends: [], incoming: [], outgoing: [] }

export function useConnections(token, enabled, query) {
  const [lists, setLists] = useState({ status: 'idle', ...empty })
  const [search, setSearch] = useState({ status: 'idle', items: [], query: '' })
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const refresh = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!enabled || !token) return undefined
    const controller = new AbortController()
    getConnections(token, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setLists({ status: 'ready', ...data }) })
      .catch(() => { if (!controller.signal.aborted) setLists(previous => ({ ...previous, status: 'error' })) })
    return () => controller.abort()
  }, [enabled, token, revision])

  useEffect(() => {
    if (!enabled || !token || typeof window === 'undefined') return undefined
    const onFocus = () => { if (!pending.current) refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, token, refresh])

  const trimmed = query.trim()
  useEffect(() => {
    if (!enabled || !token || trimmed.length < 2 || trimmed.length > 100) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlayers(token, trimmed, { signal: controller.signal })
        .then(items => { if (!controller.signal.aborted) setSearch({ status: 'ready', items, query: trimmed }) })
        .catch(() => { if (!controller.signal.aborted) setSearch({ status: 'error', items: [], query: trimmed }) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [enabled, token, trimmed, revision])

  async function act(person, action) {
    if (!token || pending.current || lists.status !== 'ready') return false
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await changeConnection(token, person.id, action)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection action failed')
      return false
    } finally {
      // Invalidate the old lists while reloading, even after a conflict.
      setLists(previous => ({ ...previous, status: 'loading' }))
      setSearch({ status: 'idle', items: [], query: '' })
      refresh()
      pending.current = false
      setBusy(false)
    }
  }

  const activeSearch = trimmed.length < 2 || trimmed.length > 100 ? { status: 'idle', items: [] } : search.query === trimmed ? search : { status: 'loading', items: [] }
  return { ...lists, search: activeSearch, busy, error, act, refresh }
}
