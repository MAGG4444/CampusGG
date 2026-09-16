import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  Flag,
  MessageCircle,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import ReplyItem from '../components/ReplyItem.jsx'
import { forumPosts } from '../data/forumPosts.js'
import './Lobby.css'
import './PostDetail.css'

const RECOMMENDATIONS_PER_PAGE = 2

function VoteControls({ baseLikes, baseDislikes, onComment, label }) {
  const [vote, setVote] = useState(null)

  const visibleLikes = baseLikes + (vote === 'like' ? 1 : 0)
  const visibleDislikes = baseDislikes + (vote === 'dislike' ? 1 : 0)

  function toggleVote(nextVote) {
    setVote((currentVote) => (currentVote === nextVote ? null : nextVote))
  }

  return (
    <div className="post-detail-actions" aria-label={`${label} actions`}>
      <button
        className={`post-icon-button ${vote === 'like' ? 'post-icon-button-active' : ''}`}
        type="button"
        onClick={() => toggleVote('like')}
        aria-pressed={vote === 'like'}
      >
        <ThumbsUp size={16} strokeWidth={2.1} aria-hidden="true" />
        <span>{visibleLikes}</span>
      </button>
      <button
        className={`post-icon-button ${vote === 'dislike' ? 'post-icon-button-active' : ''}`}
        type="button"
        onClick={() => toggleVote('dislike')}
        aria-pressed={vote === 'dislike'}
      >
        <ThumbsDown size={16} strokeWidth={2.1} aria-hidden="true" />
        <span>{visibleDislikes}</span>
      </button>
      <button className="post-icon-button" type="button" onClick={onComment} aria-label={`Reply to ${label}`}>
        <MessageCircle size={16} strokeWidth={2.1} aria-hidden="true" />
      </button>
    </div>
  )
}

function PostDetail() {
  const navigate = useNavigate()
  const { postId } = useParams()
  const replyInputRef = useRef(null)
  const post = forumPosts.find((forumPost) => String(forumPost.id) === postId)
  const [isSaved, setIsSaved] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [replyText, setReplyText] = useState('')
  const [localReplies, setLocalReplies] = useState([])
  const [replyTarget, setReplyTarget] = useState(null)
  const [autoExpandReplyId, setAutoExpandReplyId] = useState(null)
  const [recommendationPage, setRecommendationPage] = useState(1)

  const recommendations = useMemo(() => {
    if (!post) {
      return []
    }

    return forumPosts.filter((forumPost) => forumPost.id !== post.id && forumPost.category === post.category)
  }, [post])

  if (!post) {
    return (
      <div className="post-detail-wrapper">
        <button className="post-back-button" type="button" onClick={() => navigate('/forum')}>
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
          <span className="sr-only">Back to Forum</span>
        </button>
        <section className="post-not-found">
          <h1>Post not found.</h1>
          <button className="post-return-button" type="button" onClick={() => navigate('/forum')}>
            Return to Forum
          </button>
        </section>
      </div>
    )
  }

  const replies = [...post.replies, ...localReplies]
  const topLevelReplies = replies.filter((reply) => reply.parentReplyId === null)
  const totalRecommendationPages = Math.max(1, Math.ceil(recommendations.length / RECOMMENDATIONS_PER_PAGE))
  const safeRecommendationPage = Math.min(recommendationPage, totalRecommendationPages)
  const firstRecommendationIndex = (safeRecommendationPage - 1) * RECOMMENDATIONS_PER_PAGE
  const visibleRecommendations = recommendations.slice(
    firstRecommendationIndex,
    firstRecommendationIndex + RECOMMENDATIONS_PER_PAGE,
  )

  function focusReplyBox() {
    replyInputRef.current?.focus()
  }

  function handlePostComment() {
    setReplyTarget(null)
    setFeedback('')
    focusReplyBox()
  }

  function handleReplyToReply(reply) {
    setReplyTarget(reply)
    setFeedback('')
    focusReplyBox()
  }

  function handleSave() {
    setIsSaved((saved) => {
      const nextSaved = !saved
      setFeedback(nextSaved ? 'Post saved.' : 'Post removed from saved.')
      return nextSaved
    })
  }

  function handleReport() {
    setFeedback('Post reported.')
  }

  function addReply(event) {
    event.preventDefault()
    const nextReply = replyText.trim()

    if (!nextReply) {
      setFeedback('Enter a reply before posting.')
      return
    }

    setLocalReplies((currentReplies) => [
      ...currentReplies,
      {
        id: `local-${Date.now()}`,
        postId: post.id,
        parentReplyId: replyTarget?.id ?? null,
        author: 'You',
        time: 'Just now',
        content: nextReply,
        likes: 0,
        dislikes: 0,
      },
    ])
    setAutoExpandReplyId(replyTarget ? { replyId: replyTarget.id, requestId: Date.now() } : null)
    setReplyText('')
    setFeedback('Reply posted.')
  }

  function selectRecommendationPage(page) {
    setRecommendationPage(Math.min(Math.max(1, page), totalRecommendationPages))
  }

  return (
    <div className="post-detail-wrapper">
      <button className="post-back-button" type="button" aria-label="Back to Forum" onClick={() => navigate('/forum')}>
        <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
      </button>

      <section className="post-detail-header">
        <div className="post-title-block">
          <h1>{post.title}</h1>
          <p>{post.subtitle}</p>
        </div>

        <aside className="post-meta-panel" aria-label="Post information">
          <div className="post-detail-toolbar">
            <button
              className={`post-toolbar-button ${isSaved ? 'post-toolbar-button-active' : ''}`}
              type="button"
              onClick={handleSave}
              aria-pressed={isSaved}
            >
              <Bookmark size={15} strokeWidth={2.1} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
              <span>Save</span>
            </button>
            <button className="post-toolbar-button" type="button" onClick={handleReport}>
              <Flag size={15} strokeWidth={2.1} aria-hidden="true" />
              <span>Report</span>
            </button>
          </div>
          <p className="post-author">{post.author}</p>
          <p className="post-time">{post.time}</p>
        </aside>
      </section>

      <div className="post-detail-feedback" aria-live="polite">
        {feedback}
      </div>

      <section className="post-content-row" aria-label="Post details">
        <article className="post-detail-box">
          <p>{post.content}</p>
        </article>
        <VoteControls baseLikes={post.likes} baseDislikes={post.dislikes} label="Post" onComment={handlePostComment} />
      </section>

      <section className="post-replies" aria-label="Replies">
        {topLevelReplies.map((reply) => (
          <ReplyItem
            key={reply.id}
            reply={reply}
            replies={replies}
            autoExpandReplyId={autoExpandReplyId}
            onReply={handleReplyToReply}
          />
        ))}
      </section>

      <form className="reply-form" onSubmit={addReply}>
        <div className="reply-target-row">
          <span>{replyTarget ? `Replying to ${replyTarget.author}` : 'Reply to post'}</span>
          {replyTarget ? (
            <button className="reply-target-cancel" type="button" onClick={() => setReplyTarget(null)}>
              Cancel
            </button>
          ) : null}
        </div>
        <label className="sr-only" htmlFor="post-reply">
          Add a reply
        </label>
        <textarea
          id="post-reply"
          ref={replyInputRef}
          value={replyText}
          placeholder="Reply Post"
          onChange={(event) => {
            setReplyText(event.target.value)
            setFeedback('')
          }}
        />
        <button className="reply-submit-button" type="submit">
          <Send size={14} strokeWidth={2.1} aria-hidden="true" />
          <span>Reply</span>
        </button>
      </form>

      <section className="similar-section" aria-label="Similar Recommendations">
        <h2>Similar Recommendations</h2>
        {visibleRecommendations.length > 0 ? (
          <div className="similar-list">
            {visibleRecommendations.map((recommendation) => (
              <button
                className="similar-post-button"
                key={recommendation.id}
                type="button"
                onClick={() => navigate(`/forum/${recommendation.id}`)}
              >
                <span>{recommendation.title}</span>
                <small>{recommendation.category}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="similar-empty">No similar recommendations yet.</p>
        )}
      </section>

      <nav className="pagination post-detail-pagination" aria-label="Similar Recommendations pagination">
        <button
          className="pagination-item"
          type="button"
          onClick={() => selectRecommendationPage(safeRecommendationPage - 1)}
          disabled={safeRecommendationPage === 1}
        >
          Previous
        </button>
        {Array.from({ length: totalRecommendationPages }, (_, index) => index + 1).map((page) => (
          <button
            className={`pagination-item ${safeRecommendationPage === page ? 'pagination-item-active' : ''}`}
            key={page}
            type="button"
            onClick={() => selectRecommendationPage(page)}
          >
            {page}
          </button>
        ))}
        <span className="pagination-ellipsis" aria-hidden="true">
          ...
        </span>
        <button
          className="pagination-item"
          type="button"
          onClick={() => selectRecommendationPage(safeRecommendationPage + 1)}
          disabled={safeRecommendationPage === totalRecommendationPages}
        >
          Next
        </button>
      </nav>

      <img className="post-detail-logo" src={logo} alt="CampusGG logo" />
    </div>
  )
}

export default PostDetail
