
import { useEffect, useState } from 'react'
import { Flag, Heart, MessageCircle } from 'lucide-react'

import { useAuth } from '../context/useAuth.js'

import {
  getMyForumLike,
  likeForumPost,
  unlikeForumPost,
} from '../api/forum.js'

function ForumPost({
  id,
  title,
  author,
  time,
  category,
  summary,
  likes = 0,
  replies,
  onReadMore,
  onReport,
}) {
  const { token } = useAuth()

  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(
    Number(likes) || 0
  )
  const [isBusy, setIsBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    setLikeCount(Number(likes) || 0)
    setIsLiked(false)
    setStatus('')

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
  }, [id, token, likes])

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
      <div className="forum-post-main">
        <h2 className="forum-post-title">
          {title}
        </h2>

        <p className="forum-post-meta">
          By {author} · {time} · {category}
        </p>

        <p className="forum-post-summary">
          {summary}
        </p>
      </div>

      <aside
        className="forum-post-side"
        aria-label={`${title} actions`}
      >
        <button
          className="forum-report-button"
          type="button"
          onClick={onReport}
        >
          <Flag
            className="forum-post-icon"
            size={12}
            strokeWidth={2.2}
            aria-hidden="true"
          />
          <span>Report</span>
        </button>

        <button
          className={`forum-count-button ${
            isLiked ? 'forum-count-button-active' : ''
          }`}
          type="button"
          onClick={toggleLike}
          disabled={isBusy}
          aria-pressed={isLiked}
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          <Heart
            className="forum-post-icon"
            size={12}
            strokeWidth={2.2}
            aria-hidden="true"
          />
          <span>{likeCount} likes</span>
        </button>

        <span className="forum-reply-count">
          <MessageCircle
            className="forum-post-icon"
            size={12}
            strokeWidth={2.2}
            aria-hidden="true"
          />
          <span>{replies ?? '—'} replies</span>
        </span>

        <button
          className="read-more-button"
          type="button"
          onClick={onReadMore}
        >
          Read More
        </button>

        {status && (
          <small role="status">
            {status}
          </small>
        )}
      </aside>
    </article>
  )
}

export default ForumPost
