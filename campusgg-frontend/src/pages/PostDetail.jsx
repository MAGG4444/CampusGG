
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  ArrowLeft,
  Bookmark,
  Flag,
  MessageCircle,
  Pencil,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'

import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

import logo from '../assets/LOGO.png'
import ReplyItem from '../components/ReplyItem.jsx'

import {
  getForumPost,
  getAllForumComments,
  getMyForumLike,
  getForumRecommendations,
  likeForumPost,
  unlikeForumPost,
  createForumComment,
  updateForumComment,
  deleteForumComment,
  updateForumPost,
  deleteForumPost,
} from '../api/forum.js'

import './Lobby.css'
import './PostDetail.css'

const RECOMMENDATIONS_PER_PAGE = 2

function normalizeComment(comment) {
  return {
    ...comment,
    parentReplyId: null,
    authorId: comment.author?.id,
    author:
      comment.author?.displayName ||
      comment.author?.username ||
      'Unknown User',
    time: comment.createdAt
      ? new Date(comment.createdAt).toLocaleString()
      : '',
    likes: 0,
    dislikes: 0,
  }
}

function PostDetail() {
  const navigate = useNavigate()
  const { postId } = useParams()
  const { token, user } = useAuth()

  const replyInputRef = useRef(null)

  // Backend data
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [recommendations, setRecommendations] = useState([])

  // General UI
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState('')

  // Replies
  const [replyText, setReplyText] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [isSubmittingReply, setIsSubmittingReply] =
    useState(false)

  // Likes
  const [isLiked, setIsLiked] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const [isLikeStatusReady, setIsLikeStatusReady] =
    useState(false)

  // Post controls
  const [isSaved, setIsSaved] = useState(false)
  const [isEditingPost, setIsEditingPost] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editGame, setEditGame] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isSavingPost, setIsSavingPost] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)

  const [recommendationPage, setRecommendationPage] =
    useState(1)

  // ======================================================
  // LOAD POST, COMMENTS, AND LIKE STATUS
  // ======================================================

  useEffect(() => {
    const controller = new AbortController()

    setIsLoading(true)
    setLoadError('')
    setFeedback('')
    setPost(null)
    setComments([])
    setRecommendations([])
    setIsLiked(false)
    setIsLikeStatusReady(false)
    setReplyText('')
    setReplyTarget(null)
    setIsEditingPost(false)
    setIsSaved(false)
    setRecommendationPage(1)

    async function load() {
      try {
        const [postResult, commentResult] =
          await Promise.all([
            getForumPost(postId, controller.signal),
            getAllForumComments(
              postId,
              controller.signal,
            ),
          ])

        if (controller.signal.aborted) return

        setPost(postResult)
        setComments(commentResult)
        setIsLoading(false)

        // Read the real user's like state from PostgreSQL.
        if (token) {
          try {
            const result = await getMyForumLike(
              postId,
              token,
              controller.signal,
            )

            if (!controller.signal.aborted) {
              setIsLiked(Boolean(result.liked))
            }
          } catch (error) {
            if (!controller.signal.aborted) {
              setFeedback(
                `Could not load your like state: ${error.message}`
              )
            }
          }
        }

        if (!controller.signal.aborted) {
          setIsLikeStatusReady(true)
        }

        try {
          const matches = await getForumRecommendations(
            postResult.game,
            postResult.id,
            controller.signal,
          )

          if (!controller.signal.aborted) {
            setRecommendations(matches)
          }
        } catch {
          // Recommendations should not block the post.
        }
      } catch (error) {
        if (controller.signal.aborted) return

        setLoadError(
          error.message || 'Unable to retrieve post.'
        )

        setIsLoading(false)
      }
    }

    load()

    return () => controller.abort()
  }, [postId, token])

  // ======================================================
  // DERIVED DATA
  // ======================================================

  const isOwner = Boolean(
    user?.id &&
    post?.author?.id &&
    user.id === post.author.id
  )

  const authorName =
    post?.author?.displayName ||
    post?.author?.username ||
    'Unknown User'

  const postTime = post?.createdAt
    ? new Date(post.createdAt).toLocaleString()
    : ''

  const replies = useMemo(
    () => comments.map(normalizeComment),
    [comments],
  )

  const totalRecommendationPages = Math.max(
    1,
    Math.ceil(
      recommendations.length / RECOMMENDATIONS_PER_PAGE
    ),
  )

  const safeRecommendationPage = Math.min(
    recommendationPage,
    totalRecommendationPages,
  )

  const visibleRecommendations = recommendations.slice(
    (safeRecommendationPage - 1) *
      RECOMMENDATIONS_PER_PAGE,
    safeRecommendationPage *
      RECOMMENDATIONS_PER_PAGE,
  )

  // ======================================================
  // REPLIES
  // ======================================================

  function handleReply(reply) {
    setReplyTarget(reply)

    setFeedback(
      'Replies are currently flat; your comment will include an @mention.'
    )

    replyInputRef.current?.focus()
  }

  async function addReply(event) {
    event.preventDefault()

    if (!token) {
      setFeedback('Please sign in to comment.')
      return
    }

    if (!post || isSubmittingReply) return

    const content = `${
      replyTarget ? `@${replyTarget.author} ` : ''
    }${replyText.trim()}`.trim()

    if (!content || content.length > 2000) {
      setFeedback(
        'Comment must contain 1–2000 characters.'
      )
      return
    }

    setIsSubmittingReply(true)

    try {
      const saved = await createForumComment(
        post.id,
        content,
        token,
      )

      setComments((current) => [
        ...current,
        saved,
      ])

      setReplyText('')
      setReplyTarget(null)
      setFeedback('Reply posted successfully.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  async function handleEditComment(reply, content) {
    if (!token) {
      throw new Error(
        'Please sign in to edit comments.'
      )
    }

    const updated = await updateForumComment(
      post.id,
      reply.id,
      content,
      token,
    )

    setComments((current) =>
      current.map((item) =>
        item.id === reply.id ? updated : item
      )
    )

    setFeedback('Comment updated.')
  }

  async function handleDeleteComment(reply) {
    if (!token) {
      throw new Error(
        'Please sign in to delete comments.'
      )
    }

    await deleteForumComment(
      post.id,
      reply.id,
      token,
    )

    setComments((current) =>
      current.filter(
        (item) => item.id !== reply.id
      )
    )

    setFeedback('Comment deleted.')
  }

  // ======================================================
  // POST LIKES
  // ======================================================

  async function handleToggleLike() {
    if (!token) {
      setFeedback('Please sign in to like posts.')
      return
    }

    if (!post || isLiking) return

    setIsLiking(true)
    setFeedback('')

    try {
      const status = await getMyForumLike(
        post.id,
        token,
      )

      const result = status.liked
        ? await unlikeForumPost(post.id, token)
        : await likeForumPost(post.id, token)

      setIsLiked(!status.liked)
      setIsLikeStatusReady(true)

      setPost((current) => ({
        ...current,
        likeCount: Number(result.likeCount) || 0,
      }))

      setFeedback(
        status.liked
          ? 'Like removed.'
          : 'Post liked.'
      )
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsLiking(false)
    }
  }

  // ======================================================
  // EDIT AND DELETE POST
  // ======================================================

  function beginEditingPost() {
    setEditTitle(post.title)
    setEditContent(post.content)
    setEditGame(post.game || '')
    setIsEditingPost(true)
    setFeedback('')
  }

  async function savePost(event) {
    event.preventDefault()

    if (!isOwner || !token || isSavingPost) {
      return
    }

    const title = editTitle.trim()
    const content = editContent.trim()

    if (
      title.length < 3 ||
      title.length > 120 ||
      !content ||
      content.length > 10000 ||
      editGame.trim().length > 50
    ) {
      setFeedback(
        'Title: 3–120 characters. Content: 1–10000. Game: up to 50.'
      )
      return
    }

    setIsSavingPost(true)
    setFeedback('')

    try {
      const updated = await updateForumPost(
        post.id,
        {
          title,
          content,
          game: editGame.trim(),
        },
        token,
      )

      setPost(updated)
      setIsEditingPost(false)

      setFeedback('Post updated successfully.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setIsSavingPost(false)
    }
  }

  async function removePost() {
    if (!isOwner || !token || isDeletingPost) {
      return
    }

    if (
      !window.confirm(
        'Permanently delete this post and its comments?'
      )
    ) {
      return
    }

    setIsDeletingPost(true)

    try {
      await deleteForumPost(post.id, token)

      navigate('/forum', {
        replace: true,
      })
    } catch (error) {
      setFeedback(error.message)
      setIsDeletingPost(false)
    }
  }

  // ======================================================
  // LOADING AND ERROR VIEW
  // ======================================================

  if (isLoading || loadError || !post) {
    return (
      <div className="post-detail-wrapper page-enter">
        <button
          className="post-back-button"
          type="button"
          aria-label="Back to Forum"
          onClick={() => navigate('/forum')}
        >
          <ArrowLeft
            size={28}
            aria-hidden="true"
          />
        </button>

        <section
          className="post-not-found"
          role="status"
        >
          <h1>
            {isLoading
              ? 'Loading post...'
              : loadError?.includes('not found')
                ? 'Post not found.'
                : 'Unable to load post.'}
          </h1>

          {!isLoading && (
            <>
              <p>{loadError}</p>

              <button
                className="post-return-button"
                type="button"
                onClick={() => navigate('/forum')}
              >
                Return to Forum
              </button>
            </>
          )}
        </section>
      </div>
    )
  }

  // ======================================================
  // MAIN POST DETAIL PAGE
  // ======================================================

  return (
    <div className="post-detail-wrapper page-enter">
      <button
        className="post-back-button"
        type="button"
        aria-label="Back to Forum"
        onClick={() => navigate('/forum')}
      >
        <ArrowLeft
          size={28}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>

      <section className="post-detail-header">
        <div className="post-title-block">
          <p className="post-detail-eyebrow">
            {post.game || 'General'}
          </p>

          <h1>{post.title}</h1>
        </div>

        <aside
          className="post-meta-panel"
          aria-label="Post information"
        >
          <div className="post-detail-toolbar">
            <button
              className={`post-toolbar-button ${
                isSaved
                  ? 'post-toolbar-button-active'
                  : ''
              }`}
              type="button"
              onClick={() => {
                setIsSaved(!isSaved)
                setFeedback(
                  'Saved posts are local to this page and are not yet synced to CampusGG.'
                )
              }}
              aria-pressed={isSaved}
            >
              <Bookmark
                size={15}
                fill={
                  isSaved
                    ? 'currentColor'
                    : 'none'
                }
                aria-hidden="true"
              />
              <span>Save</span>
            </button>

            <button
              className="post-toolbar-button"
              type="button"
              onClick={() =>
                setFeedback(
                  'Reporting is not connected to the backend yet. No report was submitted.'
                )
              }
            >
              <Flag
                size={15}
                aria-hidden="true"
              />
              <span>Report</span>
            </button>

            {isOwner && (
              <>
                <button
                  className="post-toolbar-button"
                  type="button"
                  onClick={beginEditingPost}
                >
                  <Pencil
                    size={15}
                    aria-hidden="true"
                  />
                  <span>Edit</span>
                </button>

                <button
                  className="post-toolbar-button"
                  type="button"
                  disabled={isDeletingPost}
                  onClick={removePost}
                >
                  <Trash2
                    size={15}
                    aria-hidden="true"
                  />
                  <span>
                    {isDeletingPost
                      ? 'Deleting...'
                      : 'Delete'}
                  </span>
                </button>
              </>
            )}
          </div>

          <p className="post-author">
            {authorName}
          </p>

          <p className="post-time">
            {postTime}
          </p>
        </aside>
      </section>

      <div
        className="post-detail-feedback"
        aria-live="polite"
      >
        {feedback}
      </div>

      {/* Post content and voting */}
      <section
        className="post-content-row"
        aria-label="Post details"
      >
        <article className="post-detail-box">
          {isEditingPost ? (
            <form
              onSubmit={savePost}
              style={{
                display: 'grid',
                gap: 10,
                width: '100%',
              }}
            >
              <label htmlFor="edit-post-title">
                Title
              </label>

              <input
                id="edit-post-title"
                value={editTitle}
                maxLength={120}
                onChange={(event) =>
                  setEditTitle(event.target.value)
                }
              />

              <label htmlFor="edit-post-game">
                Game
              </label>

              <input
                id="edit-post-game"
                value={editGame}
                maxLength={50}
                onChange={(event) =>
                  setEditGame(event.target.value)
                }
              />

              <label htmlFor="edit-post-content">
                Content
              </label>

              <textarea
                id="edit-post-content"
                rows={7}
                value={editContent}
                maxLength={10000}
                onChange={(event) =>
                  setEditContent(event.target.value)
                }
              />

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                }}
              >
                <button
                  type="submit"
                  disabled={isSavingPost}
                >
                  {isSavingPost
                    ? 'Saving...'
                    : 'Save changes'}
                </button>

                <button
                  type="button"
                  disabled={isSavingPost}
                  onClick={() =>
                    setIsEditingPost(false)
                  }
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {post.content}
            </p>
          )}
        </article>

        <div
          className="post-detail-actions"
          aria-label="Post actions"
        >
          <button
            className={`post-icon-button ${
              isLiked
                ? 'post-icon-button-active'
                : ''
            }`}
            type="button"
            onClick={handleToggleLike}
            disabled={
              isLiking || !isLikeStatusReady
            }
            aria-pressed={isLiked}
            aria-label={
              isLiked
                ? 'Unlike post'
                : 'Like post'
            }
          >
            <ThumbsUp
              size={16}
              strokeWidth={2.1}
              aria-hidden="true"
            />
            <span>
              {Number(post.likeCount) || 0}
            </span>
          </button>

          <button
            className="post-icon-button"
            type="button"
            disabled
            title="Dislikes are not supported yet"
            aria-label="Dislikes unavailable"
          >
            <ThumbsDown
              size={16}
              aria-hidden="true"
            />
            <span>—</span>
          </button>

          <button
            className="post-icon-button"
            type="button"
            onClick={() => {
              setReplyTarget(null)
              replyInputRef.current?.focus()
            }}
            aria-label="Reply to post"
          >
            <MessageCircle
              size={16}
              aria-hidden="true"
            />
          </button>
        </div>
      </section>

      {/* Database comments */}
      <section
        className="post-replies"
        aria-label="Replies"
      >
        {replies.length === 0 && (
          <p className="similar-empty">
            No replies yet. Be the first to comment!
          </p>
        )}

        {replies.map((reply) => (
          <ReplyItem
            key={reply.id}
            reply={reply}
            replies={replies}
            autoExpandReplyId={null}
            onReply={handleReply}
            onEdit={handleEditComment}
            onDelete={handleDeleteComment}
            currentUserId={user?.id}
          />
        ))}
      </section>

      {/* Reply creation */}
      <form
        className="reply-form"
        onSubmit={addReply}
      >
        <div className="reply-target-row">
          <span>
            {replyTarget
              ? `Mentioning ${replyTarget.author} (regular comment)`
              : 'Reply to post'}
          </span>

          {replyTarget && (
            <button
              className="reply-target-cancel"
              type="button"
              onClick={() => setReplyTarget(null)}
            >
              Cancel
            </button>
          )}
        </div>

        <label
          className="sr-only"
          htmlFor="post-reply"
        >
          Add a reply
        </label>

        <textarea
          id="post-reply"
          ref={replyInputRef}
          value={replyText}
          maxLength={2000}
          placeholder="Reply Post"
          disabled={isSubmittingReply}
          onChange={(event) => {
            setReplyText(event.target.value)
            setFeedback('')
          }}
        />

        <button
          className="reply-submit-button"
          type="submit"
          disabled={isSubmittingReply}
        >
          <Send
            size={14}
            strokeWidth={2.1}
            aria-hidden="true"
          />

          <span>
            {isSubmittingReply
              ? 'Posting...'
              : 'Reply'}
          </span>
        </button>
      </form>

      {/* Recommendations */}
      <section
        className="similar-section"
        aria-label="Similar Recommendations"
      >
        <h2>Similar Recommendations</h2>

        {visibleRecommendations.length ? (
          <div className="similar-list">
            {visibleRecommendations.map(
              (suggestion) => (
                <button
                  className="similar-post-button"
                  key={suggestion.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/forum/${suggestion.id}`
                    )
                  }
                >
                  <span>
                    {suggestion.title}
                  </span>

                  <small>
                    {suggestion.game || 'General'}
                  </small>
                </button>
              )
            )}
          </div>
        ) : (
          <p className="similar-empty">
            No similar recommendations yet.
          </p>
        )}
      </section>

      <nav
        className="pagination post-detail-pagination"
        aria-label="Similar recommendations pagination"
      >
        <button
          className="pagination-item"
          type="button"
          disabled={
            safeRecommendationPage === 1
          }
          onClick={() =>
            setRecommendationPage(
              Math.max(
                1,
                safeRecommendationPage - 1
              )
            )
          }
        >
          Previous
        </button>

        {Array.from(
          {
            length: totalRecommendationPages,
          },
          (_, index) => index + 1
        ).map((page) => (
          <button
            className={`pagination-item ${
              safeRecommendationPage === page
                ? 'pagination-item-active'
                : ''
            }`}
            key={page}
            type="button"
            aria-current={
              safeRecommendationPage === page
                ? 'page'
                : undefined
            }
            onClick={() =>
              setRecommendationPage(page)
            }
          >
            {page}
          </button>
        ))}

        <button
          className="pagination-item"
          type="button"
          disabled={
            safeRecommendationPage ===
            totalRecommendationPages
          }
          onClick={() =>
            setRecommendationPage(
              Math.min(
                totalRecommendationPages,
                safeRecommendationPage + 1
              )
            )
          }
        >
          Next
        </button>
      </nav>

      <img
        className="post-detail-logo"
        src={logo}
        alt="CampusGG logo"
      />
    </div>
  )
}

export default PostDetail
