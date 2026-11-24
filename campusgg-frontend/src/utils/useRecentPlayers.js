import { useCallback, useEffect, useState } from 'react'
import { getRecentPlayers } from '../api/recentPlayers.js'

export function useRecentPlayers(token, enabled) {
  const [snapshot, setSnapshot] = useState(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    if (!token || !enabled) return undefined
    const controller = new AbortController()
    const fetchHistory = () => {
      getRecentPlayers(token, { signal: controller.signal })
        .then(items => { if (!controller.signal.aborted) setSnapshot({ token, revision, status: 'ready', items }) })
        .catch(() => { if (!controller.signal.aborted) setSnapshot({ token, revision, status: 'error', items: [] }) })
    }
    fetchHistory()
    return () => controller.abort()
  }, [token, enabled, revision])
  useEffect(() => {
    if (!enabled || !token || typeof window === 'undefined') return undefined
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [enabled, token, refresh])
  if (!token) return { status: 'signin', items: [], refresh }
  return enabled && snapshot?.token === token && snapshot.revision === revision
    ? { ...snapshot, refresh } : { status: 'loading', items: [], refresh }
}
