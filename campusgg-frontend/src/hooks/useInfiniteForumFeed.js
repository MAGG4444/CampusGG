import { useCallback, useEffect, useRef, useState } from 'react'
import { request } from '../api/request.js'
import { normalizePost } from '../utils/forumPost.js'

const LIMIT = 20
const cache = new Map()
let activeScope
function cached(scope, key) {
  if (activeScope !== scope) { cache.clear(); activeScope = scope }
  return cache.get(key)
}

// Each mounted instance has a fixed URL and account; the parent keys it by both.
export function useInfiniteForumFeed(url, token, scope) {
  const key = `${scope}:${url}`
  const [state, setState] = useState(() => cached(scope, key) || { posts: [], page: 0, total: 0, loading: true, error: false })
  const current = useRef(state)
  const running = useRef(false)
  const abort = useRef(null)
  const alive = useRef(false)
  const failedPage = useRef(1)
  const update = useCallback((value) => { current.current = value; setState(value) }, [])
  const load = useCallback(async (page) => {
    if (running.current) return
    running.current = true
    const controller = new AbortController()
    failedPage.current = page
    abort.current = controller
    update({ ...current.current, loading: true, error: false })
    try {
      const join = url.includes('?') ? '&' : '?'
      const data = await request(`${url}${join}page=${page}&limit=${LIMIT}`, { token, signal: controller.signal })
      if (!Array.isArray(data.posts) || !Number.isFinite(Number(data.total))) throw new Error('Invalid feed response')
      if (controller.signal.aborted || !alive.current) return
      const existing = page === 1 ? [] : current.current.posts
      const seen = new Set(existing.map((post) => post.id))
      const posts = [...existing]
      for (const raw of data.posts) {
        if (!seen.has(raw.id)) { seen.add(raw.id); posts.push(normalizePost(raw, raw.replyCount)) }
      }
      update({ posts, page, total: Number(data.total), loading: false, error: false, hasMore: data.posts.length > 0 && page * LIMIT < Number(data.total) })
    } catch (err) {
      const message = err.status === 404 ? 'Feed endpoint not found (404). Check that the backend is up to date.' : err.message || 'Unable to reach the backend.'
      if (!controller.signal.aborted && alive.current) update({ ...current.current, loading: false, error: message })
    } finally { if (abort.current === controller) running.current = false }
  }, [url, token, update])
  useEffect(() => {
    alive.current = true
    if (current.current.page === 0) load(1)
    return () => {
      alive.current = false
      abort.current?.abort()
      running.current = false
      if (current.current.page > 0 && activeScope === scope) {
        cache.set(key, { ...current.current, loading: false, error: false })
        if (cache.size > 8) cache.delete(cache.keys().next().value)
      }
    }
  }, [key, scope, load])
  const more = useCallback(() => { if (!current.current.loading && !current.current.error && current.current.hasMore) load(current.current.page + 1) }, [load])
  const retry = useCallback(() => { if (!current.current.loading) load(failedPage.current) }, [load])
  const refresh = useCallback(() => { if (!current.current.loading) load(1) }, [load])
  return { ...state, more, retry, refresh }
}
