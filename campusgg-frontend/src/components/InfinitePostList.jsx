import { useEffect, useRef, useState } from 'react'
import { useInfiniteForumFeed } from '../hooks/useInfiniteForumFeed.js'
import ForumPost from './ForumPost.jsx'
import { channelForGame } from '../utils/channelPresentation.js'

export default function InfinitePostList({ url, token, scope, catalog = [], emptyMessage = 'No posts found.' }) {
  const feed = useInfiniteForumFeed(url, token, scope)
  const { loading, error, hasMore, more } = feed
  const sentinel = useRef(null)
  const armed = useRef(true)
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    if (!sentinel.current || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) armed.current = true
      else if (armed.current && !loading && !error && hasMore) { armed.current = false; more() }
    }, { rootMargin: '300px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [loading, error, hasMore, more])
  return <>
    {feed.posts.length > 0 && <><div className="forum-feed-refresh"><button type="button" onClick={feed.refresh} disabled={feed.loading}>Refresh feed</button></div><section aria-label="Forum posts">{feed.posts.map((post) => <ForumPost key={post.id} {...post} replies={post.replyCount} channel={channelForGame(catalog, post.game)} onReport={() => setFeedback(`Reporting is not connected to the backend yet. No report was submitted for ${post.title}.`)} />)}</section></>}
    <div className="join-feedback" aria-live="polite">{feedback}</div>
    {feed.loading && <div className="forum-feed-progress" role="status">{feed.page ? 'Loading more posts...' : 'Loading posts...'}</div>}
    {feed.error && <div className="forum-feed-progress" role="alert"><span>{feed.page ? 'Unable to load more posts.' : 'Unable to load posts.'} {typeof feed.error === 'string' ? feed.error : ''}</span><button type="button" onClick={feed.retry}>Try again</button></div>}
    {!feed.loading && !feed.error && feed.page > 0 && feed.posts.length === 0 && <div className="forum-feed-progress">{emptyMessage}</div>}
    {!feed.loading && !feed.error && feed.posts.length > 0 && !feed.hasMore && <div className="forum-feed-progress">You have reached the end.</div>}
    {!loading && !error && hasMore && <div className="forum-feed-progress"><button type="button" onClick={feed.more}>Load more</button></div>}
    <div ref={sentinel} aria-hidden="true" />
  </>
}
