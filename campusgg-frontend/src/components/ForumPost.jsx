import { useEffect, useState } from 'react'
import { Flag, Heart, MessageCircle, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import ChannelLogo from './ChannelLogo.jsx'

import { useAuth } from '../context/useAuth.js'

import {
  getMyForumLike,
  likeForumPost,
  unlikeForumPost,
} from '../api/forum.js'

// Remount the interactive content when the post, signed-in user, or
// server-provided like count changes. This initializes component state
// without synchronously resetting it inside an effect.
function ForumPost(props) {
  const { token } = useAuth()

  return (
    <ForumPostContent
      key={`${props.id ?? ''}:${token ?? ''}:${props.likes ?? 0}`}
      {...props}
      token={token}
    />
  )
}

function ForumPostContent({
  id,
  title,
  author,
  time,
  game,
  channel,
  summary,
  likes = 0,
  replies,
  onReport,
  token,
}) {
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(
    Number(likes) || 0
  )
  const [isBusy, setIsBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    if (token && id) {
      getMyForumLike(id, token, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setIsLiked(Boolean(result.liked))
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setStatus('Could not check like status.')
          }
        })
    }

    return () => controller.abort()
  }, [id, token])

  async function toggleLike() {
    if (!token) {
      setStatus('Sign in to like posts.')
      return
    }

    if (!id || isBusy) return

    setIsBusy(true)
    setStatus('')

    try {
      // Check the real database status before changing it.
      const state = await getMyForumLike(id, token)

      const currentlyLiked = Boolean(state.liked)

      const result = currentlyLiked
        ? await unlikeForumPost(id, token)
        : await likeForumPost(id, token)

      setIsLiked(!currentlyLiked)
      setLikeCount(Number(result.likeCount) || 0)
    } catch (error) {
      setStatus(error.message || 'Could not update like.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <article className="forum-post-card">
      <p className="forum-post-meta">
        <strong>{author}</strong>{game && <> <span aria-hidden="true">&middot;</span> {channel ? <Link className="forum-game-link" to={`/forum/channel/${channel.slug}`}><ChannelLogo channel={channel} small />{game}</Link> : <span>{game}</span>}</>}
        {' '}<span aria-hidden="true">&middot;</span> <time>{time}</time>
      </p>
      <Link className="forum-post-link" to={`/forum/${id}`}>
        <h2 className="forum-post-title">{title}</h2>
        {summary && <p className="forum-post-summary">{summary}</p>}
      </Link>
      <div className="forum-post-actions" aria-label={`${title} actions`}>
        <button
          className={`forum-count-button ${isLiked ? 'forum-count-button-active' : ''}`}
          type="button" onClick={toggleLike} disabled={isBusy} aria-pressed={isLiked}
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          <Heart size={16} aria-hidden="true" /> <span>{likeCount} likes</span>
        </button>
        <span className="forum-reply-count"><MessageCircle size={16} aria-hidden="true" /> {replies ?? '\u2014'} replies</span>
        <details className="forum-post-menu">
          <summary aria-label={`More actions for ${title}`}><MoreHorizontal size={20} aria-hidden="true" /></summary>
          <div className="forum-post-menu-items">
            <button type="button" onClick={(event) => { onReport(); event.currentTarget.closest('details').open = false }}>
              <Flag size={16} aria-hidden="true" /> Report
            </button>
          </div>
        </details>
      </div>
      {status && <small className="forum-post-status" role="status">{status}</small>}
    </article>
  )
}

export default ForumPost
