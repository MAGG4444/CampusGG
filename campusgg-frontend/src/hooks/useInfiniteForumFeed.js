import { useCallback, useEffect, useRef, useState } from 'react'
import { request } from '../api/request.js'
import { normalizePost } from '../utils/forumPost.js'

const LIMIT = 20
const cache = new Map()
let generation = 0
let followGeneration = 0
const listeners = new Set()
export function invalidateForumFeedCache() {
  generation += 1
  cache.clear()
  for (const listener of listeners) listener()
}
// Follow changes should not discard the mounted feed or its current pages.
export function invalidateInactiveForumFeeds() { followGeneration += 1; cache.clear() }
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
  const removed = useRef(new Set())
  const mountedGeneration = useRef(generation)
  const mountedFollowGeneration = useRef(state.followGeneration ?? followGeneration)
  const update = useCallback((value) => { current.current = value; setState(value) }, [])
  const load = useCallback(async (page) => {
    if (running.current) return
    running.current = true
    const controller = new AbortController()
    const requestGeneration = generation
    failedPage.current = page
    abort.current = controller
    update({ ...current.current, loading: true, error: false })
    try {
      const join = url.includes('?') ? '&' : '?'
      const data = await request(`${url}${join}page=${page}&limit=${LIMIT}`, { token, signal: controller.signal })
      if (!Array.isArray(data.posts) || !Number.isFinite(Number(data.total))) throw new Error('Invalid feed response')
      if (controller.signal.aborted || !alive.current || requestGeneration !== generation) return
      const existing = page === 1 ? [] : current.current.posts
      const seen = new Set(existing.map((post) => post.id))
      const posts = [...existing]
      for (const raw of data.posts) {
        if (!seen.has(raw.id) && !removed.current.has(raw.id)) { seen.add(raw.id); posts.push(normalizePost(raw, raw.replyCount)) }
      }
      update({ posts, page, total: Number(data.total), loading: false, error: false, hasMore: data.posts.length > 0 && page * LIMIT < Number(data.total) })
    } catch (err) {
      const message = err.status === 404 ? 'Feed endpoint not found (404). Check that the backend is up to date.' : err.message || 'Unable to reach the backend.'
      if (!controller.signal.aborted && alive.current && requestGeneration === generation) update({ ...current.current, loading: false, error: message })
    } finally { if (abort.current === controller) running.current = false }
  }, [url, token, update])
  useEffect(() => {
    alive.current = true
    mountedGeneration.current = generation
    const invalidate = () => {
      mountedGeneration.current = generation
      mountedFollowGeneration.current = followGeneration
      abort.current?.abort()
      running.current = false
      update({ posts: [], page: 0, total: 0, loading: true, error: false })
      load(1)
    }
    listeners.add(invalidate)
    if (current.current.page === 0) load(1)
    else if (mountedFollowGeneration.current !== followGeneration) {
      const controller = new AbortController()
      const expectedFollowGeneration = followGeneration
      const expectedGeneration = generation
      const pages = current.current.page
      ;(async () => {
        try {
          const responses = await Promise.all(Array.from({ length: pages }, (_, index) => request(`${url}${url.includes('?') ? '&' : '?'}page=${index + 1}&limit=${LIMIT}`, { token, signal: controller.signal })))
          if (controller.signal.aborted || !alive.current || expectedFollowGeneration !== followGeneration || expectedGeneration !== generation || current.current.page !== pages) return
          if (responses.some(data => !Array.isArray(data.posts) || !Number.isFinite(Number(data.total)))) return
          const seen = new Set()
          const posts = []
          for (const data of responses) for (const raw of data.posts) if (!seen.has(raw.id) && !removed.current.has(raw.id)) { seen.add(raw.id); posts.push(normalizePost(raw, raw.replyCount)) }
          const total = Number(responses[0].total)
          mountedFollowGeneration.current = expectedFollowGeneration
          update({ ...current.current, posts, total, hasMore: responses.at(-1).posts.length > 0 && pages * LIMIT < total })
        } catch { /* Keep cached results when background revalidation fails. */ }
      })()
      return () => {
        controller.abort()
        alive.current = false
        listeners.delete(invalidate)
        abort.current?.abort()
        running.current = false
        if (current.current.page > 0 && activeScope === scope && mountedGeneration.current === generation) cache.set(key, { ...current.current, loading: false, error: false, followGeneration: mountedFollowGeneration.current })
      }
    }
    return () => {
      alive.current = false
      listeners.delete(invalidate)
      abort.current?.abort()
      running.current = false
      if (current.current.page > 0 && activeScope === scope && mountedGeneration.current === generation) {
        cache.set(key, { ...current.current, loading: false, error: false, followGeneration: mountedFollowGeneration.current })
        if (cache.size > 8) cache.delete(cache.keys().next().value)
      }
    }
  }, [key, scope, load, update, token, url])
  const more = useCallback(() => { if (!current.current.loading && !current.current.error && current.current.hasMore) load(current.current.page + 1) }, [load])
  const retry = useCallback(() => { if (!current.current.loading) load(failedPage.current) }, [load])
  const refresh = useCallback(() => { if (!current.current.loading) load(1) }, [load])
  const removePost = useCallback((id) => {
    removed.current.add(id)
    const posts = current.current.posts.filter(post => post.id !== id)
    if (posts.length !== current.current.posts.length) update({ ...current.current, posts, total: Math.max(0, current.current.total - 1) })
  }, [update])
  return { ...state, more, retry, refresh, removePost }
}
