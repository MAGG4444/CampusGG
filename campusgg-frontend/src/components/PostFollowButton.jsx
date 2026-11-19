import { useEffect, useRef, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import { getPostFollowStatuses, setPostFollow } from '../api/forum.js'
import { invalidateInactiveForumFeeds } from '../hooks/useInfiniteForumFeed.js'

export default function PostFollowButton({ postId, following, onChange, className = 'forum-count-button', iconOnly = false, postTitle = '' }) {
  const { token } = useAuth()
  return <PostFollowContent key={`${postId}:${token || ''}:${following}`} postId={postId} token={token} initial={following} onChange={onChange} className={className} iconOnly={iconOnly} postTitle={postTitle} />
}

function PostFollowContent({ postId, token, initial, onChange, className, iconOnly, postTitle }) {
  const [following, setFollowing] = useState(initial)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!token || initial !== undefined) return undefined
    const controller = new AbortController()
    getPostFollowStatuses([postId], token, controller.signal)
      .then((data) => { if (!controller.signal.aborted) { setFollowing(data.followedIds.includes(postId)); setError('') } })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load follow status.') })
    return () => controller.abort()
  }, [postId, token, initial, retry])
  async function toggle() {
    if (!token) { setError('Sign in to follow posts.'); return }
    if (pending.current || following === undefined) return
    pending.current = true; setBusy(true); setError('')
    try {
      const result = await setPostFollow(postId, !following, token)
      setFollowing(result.following)
      invalidateInactiveForumFeeds()
      onChange?.(postId, result.following)
    } catch (err) { setError(err.message || 'Unable to update follow.') }
    finally { pending.current = false; setBusy(false) }
  }
  const label = `${following ? 'Unfollow' : 'Follow'} post${postTitle ? `: ${postTitle}` : ''}`
  return <><button type="button" className={className} onClick={toggle} disabled={busy || Boolean(token && following === undefined)} aria-pressed={Boolean(following)} aria-label={label} title={label}><Bookmark size={16} fill={following ? 'currentColor' : 'none'} aria-hidden="true" />{!iconOnly && (following ? ' Following' : ' Follow Post')}</button>{error && <span role="status">{error} {token && following === undefined && <button type="button" onClick={() => setRetry((v) => v + 1)}>Retry</button>}</span>}</>
}
