import { useId, useState } from 'react'
import { ChevronDown, ChevronRight, CornerDownRight, MessageCircle, ThumbsDown, ThumbsUp } from 'lucide-react'

const MAX_VISUAL_REPLY_LEVEL = 3

function ReplyItem({ reply, replies, level = 0, autoExpandReplyId, onReply }) {
  const [vote, setVote] = useState(null)
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false)
  const [dismissedAutoExpandRequest, setDismissedAutoExpandRequest] = useState(null)
  const childrenId = useId()
  const childReplies = replies.filter((childReply) => childReply.parentReplyId === reply.id)
  const childReplyCount = childReplies.length
  const visualLevel = Math.min(level, MAX_VISUAL_REPLY_LEVEL)
  const visibleLikes = reply.likes + (vote === 'like' ? 1 : 0)
  const visibleDislikes = reply.dislikes + (vote === 'dislike' ? 1 : 0)
  const hasChildReplies = childReplyCount > 0
  const isAutoExpanded =
    autoExpandReplyId?.replyId === reply.id && dismissedAutoExpandRequest !== autoExpandReplyId.requestId
  const isExpanded = isManuallyExpanded || isAutoExpanded

  function toggleVote(nextVote) {
    setVote((currentVote) => (currentVote === nextVote ? null : nextVote))
  }

  function toggleExpanded() {
    if (isExpanded) {
      setIsManuallyExpanded(false)

      if (isAutoExpanded) {
        setDismissedAutoExpandRequest(autoExpandReplyId.requestId)
      }

      return
    }

    setIsManuallyExpanded(true)
  }

  return (
    <div className="reply-thread" style={{ '--reply-level': visualLevel }}>
      <article className="reply-row">
        <CornerDownRight className="reply-arrow" size={24} strokeWidth={2.1} aria-hidden="true" />
        <div className="reply-box">
          <div className="reply-meta">
            <span>{reply.author}</span>
            <span>{reply.time}</span>
          </div>
          <p>{reply.content}</p>
        </div>
        <div className="post-detail-actions" aria-label={`${reply.author} reply actions`}>
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
          <button
            className="post-icon-button"
            type="button"
            onClick={() => onReply(reply)}
            aria-label={`Reply to ${reply.author}`}
          >
            <MessageCircle size={16} strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>
      </article>

      {hasChildReplies ? (
        <button
          className="reply-collapse-button"
          type="button"
          onClick={toggleExpanded}
          aria-controls={childrenId}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronDown size={14} strokeWidth={2.1} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} strokeWidth={2.1} aria-hidden="true" />
          )}
          <span>{isExpanded ? 'Hide replies' : `Show ${childReplyCount} ${childReplyCount === 1 ? 'reply' : 'replies'}`}</span>
        </button>
      ) : null}

      {hasChildReplies && isExpanded ? (
        <div className="reply-children" id={childrenId}>
          {childReplies.map((childReply) => (
            <ReplyItem
              key={childReply.id}
              reply={childReply}
              replies={replies}
              level={level + 1}
              autoExpandReplyId={autoExpandReplyId}
              onReply={onReply}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default ReplyItem
