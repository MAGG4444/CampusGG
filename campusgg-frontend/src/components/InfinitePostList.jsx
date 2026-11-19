import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useInfiniteForumFeed } from '../hooks/useInfiniteForumFeed.js'
import ForumPost from './ForumPost.jsx'
import { useAuth } from '../context/useAuth.js'
import { getPostFollowStatuses } from '../api/forum.js'
import { consumeForumRestore } from '../utils/forumFeedReturn.js'

export default function InfinitePostList({ url, token, scope, restore, feedState, followingFeed = false, emptyMessage = 'No posts found.', showRefresh = true }) {
  const feed = useInfiniteForumFeed(url, token, scope)
  const { token: accountToken } = useAuth()
  const [followed, setFollowed] = useState({})
  const [followError, setFollowError] = useState('')
  const [followRetry, setFollowRetry] = useState(0)
  const followVersions = useRef(new Map())
  const ids = feed.posts.map((post) => post.id).join(',')
  useLayoutEffect(() => {
    if (!restore || restore.url !== url || restore.scope !== scope || feed.loading || !feed.page || !consumeForumRestore(restore)) return
    if (feed.posts.some(post => post.id === restore.anchorId)) window.scrollTo({ top: restore.scrollY, behavior: 'instant' })
  }, [restore, url, scope, feed.loading, feed.page, feed.posts])
  useEffect(() => {
    if (!accountToken || !ids) return undefined
    const controller = new AbortController()
    const postIds = ids.split(',')
    const versions = new Map(followVersions.current)
    Promise.all(Array.from({ length: Math.ceil(postIds.length / 100) }, (_, i) => getPostFollowStatuses(postIds.slice(i * 100, i * 100 + 100), accountToken, controller.signal)))
      .then((results) => { if (!controller.signal.aborted) { const found = new Set(results.flatMap((item) => item.followedIds)); setFollowed(current => { const next = { ...current }; for (const id of postIds) if ((followVersions.current.get(id) || 0) === (versions.get(id) || 0)) next[id] = found.has(id); return next }); setFollowError('') } })
      .catch((error) => { if (!controller.signal.aborted) setFollowError(error.status === 401 ? 'Your session has expired. Sign in again to follow posts.' : error.status === 404 ? 'Post follow status is unavailable. Check that the backend is up to date.' : 'Unable to load post follow status. Please try again.') })
    return () => controller.abort()
  }, [accountToken, ids, followRetry])
  const { loading, error, hasMore, more } = feed
  const sentinel = useRef(null)
  const armed = useRef(true)
  useEffect(() => {
    if (!sentinel.current || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) armed.current = true
      else if (armed.current && !loading && !error && hasMore) { armed.current = false; more() }
    }, { root: null, rootMargin: '300px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [loading, error, hasMore, more])
  return <div className="forum-feed-list">
    {followError && <p role="alert">{followError} <button type="button" onClick={() => setFollowRetry((v) => v + 1)}>Retry</button></p>}
    {feed.posts.length > 0 && <>{showRefresh && <div className="forum-feed-refresh"><button type="button" onClick={feed.refresh} disabled={feed.loading}>Refresh feed</button></div>}<div className="forum-discussions" role="rowgroup">{feed.posts.map((post) => <ForumPost key={post.id} {...post} feedState={feedState} feedUrl={url} feedScope={scope} followed={accountToken ? followed[post.id] : undefined} onFollowChange={(id, value) => { followVersions.current.set(id, (followVersions.current.get(id) || 0) + 1); setFollowed((current) => ({ ...current, [id]: value })); if (followingFeed && !value) feed.removePost(id) }} />)}</div></>}
    {feed.loading && <div className="forum-feed-progress" role="status">{feed.page ? 'Loading more posts...' : 'Loading posts...'}</div>}
    {feed.error && <div className="forum-feed-progress" role="alert"><span>{feed.page ? 'Unable to load more posts.' : 'Unable to load posts.'} {typeof feed.error === 'string' ? feed.error : ''}</span><button type="button" onClick={feed.retry}>Try again</button></div>}
    {!feed.loading && !feed.error && feed.page > 0 && feed.posts.length === 0 && <div className="forum-feed-progress">{emptyMessage}</div>}
    {!loading && !error && hasMore && <div className="forum-feed-progress"><button type="button" onClick={feed.more}>Load more</button></div>}
    <div ref={sentinel} aria-hidden="true" />
  </div>
}
