import { useEffect, useState } from 'react'
import { getFriendPresence } from '../api/presence.js'

const EMPTY = new Map()
export function useFriendPresence(token) {
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    if (!token) return undefined
    const controller = new AbortController()
    let timer
    let expiry
    async function refresh() {
      try {
        const statuses = await getFriendPresence(token, { signal: controller.signal })
        if (!controller.signal.aborted) {
          setSnapshot({ token, statuses })
          clearTimeout(expiry)
          expiry = setTimeout(() => setSnapshot(null), 20_000)
        }
      } catch {
        if (!controller.signal.aborted) setSnapshot(null)
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 5000)
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(expiry) }
  }, [token])
  return token && snapshot?.token === token ? snapshot.statuses : EMPTY
}
