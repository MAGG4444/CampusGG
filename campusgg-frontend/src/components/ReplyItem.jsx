
import { useId, useState } from 'react'

import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  MessageCircle,
  Pencil,
  Trash2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'

const MAX_VISUAL_REPLY_LEVEL = 3

function ReplyItem({
  reply,
  replies = [],
  level = 0,
  autoExpandReplyId,
  onReply,
  onEdit,
  onDelete,
  currentUserId,
}) {
  const [isManuallyExpanded, setIsManuallyExpanded] =
    useState(false)

  const [
    dismissedAutoExpandRequest,
    setDismissedAutoExpandRequest,
  ] = useState(null)

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(reply.content)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const childrenId = useId()

  const childReplies = replies.filter(
    (item) => item.parentReplyId === reply.id
  )

  const isAutoExpanded =
    autoExpandReplyId?.replyId === reply.id &&
    dismissedAutoExpandRequest !== autoExpandReplyId.requestId

  const isExpanded = isManuallyExpanded || isAutoExpanded

  const isOwner = Boolean(
    currentUserId &&
    reply.authorId &&
    currentUserId === reply.authorId
  )

  function toggleExpanded() {
    if (isExpanded) {
      setIsManuallyExpanded(false)

      if (isAutoExpanded) {
        setDismissedAutoExpandRequest(
          autoExpandReplyId.requestId
        )
      }
    } else {
      setIsManuallyExpanded(true)
    }
  }

  async function saveEdit() {
    const value = editText.trim()

    if (!value || value.length > 2000) {
      setError('Comments must contain 1–2000 characters.')
      return
    }

    setBusy(true)
    setError('')

    try {
      await onEdit(reply, value)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Could not edit comment.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (
      !window.confirm(
        'Delete this comment? This cannot be undone.'
      )
    ) {
      return
    }

    setBusy(true)
    setError('')

    try {
      await onDelete(reply)
    } catch (err) {
      setError(err.message || 'Could not delete comment.')
      setBusy(false)
    }
  }

  return (
    <div
      className="reply-thread"
      style={{
        '--reply-level': Math.min(
          level,
          MAX_VISUAL_REPLY_LEVEL
        ),
      }}
    >
      <article className="reply-row">
        <CornerDownRight
          className="reply-arrow"
          size={24}
          strokeWidth={2.1}
          aria-hidden="true"
        />

        <div className="reply-box">
          <div className="reply-meta">
            <span>{reply.author}</span>
            <span>{reply.time}</span>
          </div>

          {editing ? (
            <div>
              <textarea
                value={editText}
                maxLength={2000}
                disabled={busy}
                onChange={(event) =>
                  setEditText(event.target.value)
                }
                aria-label="Edit comment"
                style={{
                  width: '100%',
                  minHeight: 90,
                  marginTop: 8,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveEdit}
                >
                  Save changes
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false)
                    setEditText(reply.content)
                    setError('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {reply.content}
            </p>
          )}

          {error && (
            <p role="alert">
              {error}
            </p>
          )}
        </div>

        <div
          className="post-detail-actions"
          aria-label={`${reply.author} reply actions`}
        >
          <button
            className="post-icon-button"
            type="button"
            disabled
            title="Comment voting is not yet supported"
            aria-label="Comment likes unavailable"
          >
            <ThumbsUp
              size={16}
              strokeWidth={2.1}
              aria-hidden="true"
            />
            <span>—</span>
          </button>

          <button
            className="post-icon-button"
            type="button"
            disabled
            title="Comment voting is not yet supported"
            aria-label="Comment dislikes unavailable"
          >
            <ThumbsDown
              size={16}
              strokeWidth={2.1}
              aria-hidden="true"
            />
            <span>—</span>
          </button>

          <button
            className="post-icon-button"
            type="button"
            onClick={() => onReply(reply)}
            aria-label={`Reply to ${reply.author}`}
          >
            <MessageCircle
              size={16}
              strokeWidth={2.1}
              aria-hidden="true"
            />
          </button>

          {isOwner && !editing && (
            <>
              <button
                className="post-icon-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditText(reply.content)
                  setEditing(true)
                }}
                aria-label="Edit your comment"
              >
                <Pencil
                  size={16}
                  aria-hidden="true"
                />
              </button>

              <button
                className="post-icon-button"
                type="button"
                disabled={busy}
                onClick={remove}
                aria-label="Delete your comment"
              >
                <Trash2
                  size={16}
                  aria-hidden="true"
                />
              </button>
            </>
          )}
        </div>
      </article>

      {childReplies.length > 0 && (
        <>
          <button
            className="reply-collapse-button"
            type="button"
            onClick={toggleExpanded}
            aria-controls={childrenId}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown
                size={14}
                aria-hidden="true"
              />
            ) : (
              <ChevronRight
                size={14}
                aria-hidden="true"
              />
            )}

            <span>
              {isExpanded
                ? 'Hide replies'
                : `Show ${childReplies.length} ${
                    childReplies.length === 1
                      ? 'reply'
                      : 'replies'
                  }`}
            </span>
          </button>

          {isExpanded && (
            <div
              className="reply-children"
              id={childrenId}
            >
              {childReplies.map((child) => (
                <ReplyItem
                  key={child.id}
                  reply={child}
                  replies={replies}
                  level={level + 1}
                  autoExpandReplyId={autoExpandReplyId}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ReplyItem
