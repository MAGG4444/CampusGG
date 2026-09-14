import { useState } from 'react'
import { Flag, Heart, MessageCircle } from 'lucide-react'

function ForumPost({ title, author, time, category, summary, likes, replies, onReadMore, onReport }) {
  const [isLiked, setIsLiked] = useState(false)

  const visibleLikes = isLiked ? likes + 1 : likes

  return (
    <article className="forum-post-card">
      <div className="forum-post-main">
        <h2 className="forum-post-title">{title}</h2>
        <p className="forum-post-meta">
          By {author} · {time} · {category}
        </p>
        <p className="forum-post-summary">{summary}</p>
      </div>

      <aside className="forum-post-side" aria-label={`${title} actions`}>
        <button className="forum-report-button" type="button" onClick={onReport}>
          <Flag className="forum-post-icon" size={12} strokeWidth={2.2} aria-hidden="true" />
          <span>Report</span>
        </button>
        <button
          className={`forum-count-button ${isLiked ? 'forum-count-button-active' : ''}`}
          type="button"
          onClick={() => setIsLiked((liked) => !liked)}
          aria-pressed={isLiked}
        >
          <Heart className="forum-post-icon" size={12} strokeWidth={2.2} aria-hidden="true" />
          <span>{visibleLikes} likes</span>
        </button>
        <span className="forum-reply-count">
          <MessageCircle className="forum-post-icon" size={12} strokeWidth={2.2} aria-hidden="true" />
          <span>{replies} replies</span>
        </span>
        <button className="read-more-button" type="button" onClick={onReadMore}>
          Read More
        </button>
      </aside>
    </article>
  )
}

export default ForumPost
