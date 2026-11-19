import { myContentReturnTo } from '../utils/myContentNavigation.js'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
  ArrowLeft,
  Flag,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'

import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useForumChannels } from '../context/forumChannelsContext.js'
import { useNotifications } from '../components/notifications/useNotifications.js'

import ReplyItem from '../components/ReplyItem.jsx'
import ReportDialog from '../components/ReportDialog.jsx'
import PostFollowButton from '../components/PostFollowButton.jsx'
import DraftNavigationDialog from '../components/DraftNavigationDialog.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'
import { invalidateForumFeedCache } from '../hooks/useInfiniteForumFeed.js'

import {
  getForumPost,
  getAllForumComments,
  getMyForumLike,
  likeForumPost,
  unlikeForumPost,
  createForumComment,
  updateForumComment,
  deleteForumComment,
  getMyCommentLikes,
  setCommentLike,
  reportForumContent,
  updateForumPost,
  deleteForumPost,
} from '../api/forum.js'

import './Lobby.css'
import './PostDetail.css'

function normalizeComment(comment) {
  return {
    ...comment,
    parentReplyId: comment.parentReplyId ?? null,
    authorId: comment.author?.id,
    author:
      comment.deletedAt ? 'Deleted reply' : comment.author?.displayName ||
      comment.author?.username ||
      'Unknown User',
    time: comment.createdAt
      ? new Date(comment.createdAt).toLocaleString()
      : '',
  }
}

// The route and authenticated user identify the data on this page.
// Using a key resets its state when either changes, without calling
// synchronous setState setters at the top of an effect.
function PostDetail() {
  const { postId } = useParams()
  const { token, user } = useAuth()

  return (
    <PostDetailContent
      key={`${postId ?? ''}:${token ?? ''}`}
      postId={postId}
      token={token}
      user={user}
    />
  )
}

function PostDetailContent({ postId, token, user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { addNotification } = useNotifications()
  const { channels } = useForumChannels() || {}
  const forumOrigin = typeof location.state?.fromForum === 'string' && /^\/forum(?:\/channel\/[a-z0-9-]+)?(?:\?[^#]*)?$/.test(location.state.fromForum) ? location.state.fromForum : '/forum'
  const returnTo = myContentReturnTo(location.state, forumOrigin)
  const returnLabel = returnTo.startsWith('/my-content?') ? 'My Content' : 'Forum'

  const replyInputRef = useRef(null)
  const backButtonRef = useRef(null)
  const postMenuRef = useRef(null)
  const repliesRef = useRef(null)
  const replyHeadingRef = useRef(null)
  const replyCompositionRef = useRef(false)
  const replySubmittingRef = useRef(false)
  const postLikePendingRef = useRef(false)
  const deletePendingRef = useRef(false)
  const postSavingRef = useRef(false)
  const editContentRef = useRef(null)

  useEffect(() => {
    const dismiss = event => {
      const menu = postMenuRef.current
      if (menu?.open && !menu.contains(event.target)) menu.open = false
    }
    const escape = event => {
      const menu = postMenuRef.current
      if (event.key === 'Escape' && menu?.open) {
        menu.open = false
        menu.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [])

  // Backend data
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [likedComments, setLikedComments] = useState([])
  const [commentLikeReady, setCommentLikeReady] = useState(!token)
  const [sort, setSort] = useState('oldest')

  // General UI
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [reportTarget, setReportTarget] = useState(null)
  const [backAboveViewport, setBackAboveViewport] = useState(false)

  // Replies
  const [replyText, setReplyText] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [newReplyId, setNewReplyId] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [isSubmittingReply, setIsSubmittingReply] =
    useState(false)

  // Likes
  const [isLiked, setIsLiked] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const [isLikeStatusReady, setIsLikeStatusReady] =
    useState(false)

  // Post controls
  const [isEditingPost, setIsEditingPost] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isSavingPost, setIsSavingPost] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmCancelEdit, setConfirmCancelEdit] = useState(false)
  const [replyEdits, setReplyEdits] = useState({})
  const [confirmCancelReply, setConfirmCancelReply] = useState(null)
  const replyEditDirty = Object.values(replyEdits).some(draft => draft.text !== draft.original)
  const editDirty = isEditingPost && (editTitle !== post?.title || editContent !== post?.content)
  const hasUnsavedEdits = editDirty || replyEditDirty
  const editBlocker = useBlocker(hasUnsavedEdits)

  useEffect(() => {
    if (!hasUnsavedEdits) return undefined
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [hasUnsavedEdits])

  useLayoutEffect(() => {
    const field = editContentRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [isEditingPost, editContent])

  useLayoutEffect(() => {
    const heading = replyHeadingRef.current
    const repliesSection = repliesRef.current
    if (!heading || !repliesSection) return undefined
    const update = () => repliesSection.style.setProperty('--reply-toolbar-height', `${heading.getBoundingClientRect().height}px`)
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(heading)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [isLoading, loadError])

  useLayoutEffect(() => {
    const heading = replyHeadingRef.current
    const shell = heading?.closest('.app-shell')
    if (!heading || !shell) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const outer = shell.getBoundingClientRect()
      const inner = heading.getBoundingClientRect()
      heading.style.setProperty('--reply-background-size', `${outer.width}px ${outer.height}px`)
      heading.style.setProperty('--reply-background-position', `${outer.left - inner.left}px ${outer.top - inner.top}px`)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(shell)
    observer?.observe(heading)
    return () => { observer?.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame) cancelAnimationFrame(frame) }
  }, [isLoading, loadError])

  useEffect(() => {
    const backButton = backButtonRef.current
    if (!backButton) return undefined
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(([entry]) => {
        setBackAboveViewport(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0)
      }, { threshold: 0 })
      observer.observe(backButton)
      return () => observer.disconnect()
    }
    let frame = 0
    const update = () => {
      frame = 0
      setBackAboveViewport(backButton.getBoundingClientRect().bottom <= 0)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame) cancelAnimationFrame(frame) }
  }, [isLoading, loadError, post?.id])

  // ======================================================
  // LOAD POST, COMMENTS, AND LIKE STATUS
  // ======================================================

  useEffect(() => {
    const controller = new AbortController()

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
            const status = await getMyCommentLikes(postId, token, controller.signal)
            if (!controller.signal.aborted) { setLikedComments(status.ids); setCommentLikeReady(true) }
          } catch (error) {
            if (!controller.signal.aborted) setFeedback(`Could not load reply likes: ${error.message}`)
          }
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

  const channel = channels?.find((item) =>
    item.name?.toLowerCase() === post?.game?.trim().toLowerCase() ||
    item.aliases?.includes(post?.game?.trim().toLowerCase())
  )

  const postTime = post?.createdAt
    ? new Date(post.createdAt).toLocaleString()
    : ''

  const replies = useMemo(
    () => comments.map(normalizeComment),
    [comments],
  )
  const unresolvedReplies = useMemo(() => {
    const byId = new Map(replies.map(reply => [reply.id, reply]))
    return replies.filter(reply => {
      const seen = new Set([reply.id])
      let parent = reply.parentReplyId
      while (parent) {
        if (seen.has(parent) || !byId.has(parent)) return true
        seen.add(parent)
        parent = byId.get(parent).parentReplyId
      }
      return false
    })
  }, [replies])
  const unresolvedIds = useMemo(() => new Set(unresolvedReplies.map(reply => reply.id)), [unresolvedReplies])
  const roots = useMemo(() => replies.filter((reply) => !reply.parentReplyId || unresolvedIds.has(reply.id)).sort((a, b) => {
    const time = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)
    const idOrder = a.id.localeCompare(b.id)
    if (sort === 'popular') return (Number(b.likeCount) || 0) - (Number(a.likeCount) || 0) || time || idOrder
    return sort === 'newest' ? -time || -idOrder : time || idOrder
  }), [replies, sort, unresolvedIds])

  // ======================================================
  // REPLIES
  // ======================================================

  function handleReply(reply) {
    if (composerOpen && replyTarget?.id === reply.id) {
      setComposerOpen(false)
      setReplyTarget(null)
    } else {
      setReplyTarget(reply)
      setComposerOpen(true)
    }
    setFeedback('')

  }

  useEffect(() => {
    if (composerOpen) { replyCompositionRef.current = false; replyInputRef.current?.focus() }
  }, [composerOpen, replyTarget])

  async function addReply(event) {
    event.preventDefault()

    if (!token) {
      setFeedback('Please sign in to comment.')
      return
    }

    if (!post || replySubmittingRef.current) return

    const content = replyText.trim()

    if (!content || content.length > 2000) {
      setFeedback(
        'Comment must contain 1–2000 characters.'
      )
      return
    }

    replySubmittingRef.current = true
    setIsSubmittingReply(true)

    try {
      const saved = await createForumComment(
        post.id,
        content,
        token,
        replyTarget?.id,
      )

      setComments((current) => current.some(item => item.id === saved.id) ? current : [...current, saved])
      if (replyTarget) setNewReplyId(saved.id)

      setReplyText('')
      setReplyTarget(null)
      setComposerOpen(false)
      setFeedback('')
      addNotification({ type: 'success', title: 'Reply posted', message: 'Reply posted successfully.' })
    } catch (error) {
      setFeedback(error.message)
    } finally {
      replySubmittingRef.current = false
      setIsSubmittingReply(false)
    }
  }

  async function handleEditComment(reply, content) {
    if (!token) {
      throw new Error(
        'Please sign in to edit comments.'
      )
    }

    if (user?.id !== reply.authorId) throw new Error('You can only edit your own replies.')

    const updated = await updateForumComment(
      post.id,
      reply.id,
      content,
      token,
    )

    setComments((current) =>
      current.map((item) =>
        item.id === reply.id ? { ...item, content: updated.content } : item
      )
    )

    setFeedback('Comment updated.')
  }

  function finishReplyEdit(id) {
    setReplyEdits(current => { const next = { ...current }; delete next[id]; return next })
  }

  async function handleCommentLike(reply) {
    if (!token) { setFeedback('Please sign in to like replies.'); return }
    const liked = !likedComments.includes(reply.id)
    const result = await setCommentLike(post.id, reply.id, liked, token)
    setLikedComments((current) => liked ? [...current, reply.id] : current.filter((id) => id !== reply.id))
    setComments((current) => current.map((item) => item.id === reply.id ? { ...item, likeCount: result.likeCount } : item))
  }

  async function handleDeleteComment(reply) {
    if (!token) {
      throw new Error(
        'Please sign in to delete comments.'
      )
    }

    const result = await deleteForumComment(
      post.id,
      reply.id,
      token,
    )

    invalidateForumFeedCache()

    setComments((current) =>
      result.tombstone ? current.map(item => item.id === reply.id ? { ...item, content: '', author: null, deletedAt: new Date().toISOString(), likeCount: 0 } : item) : current.filter(item => !(result.removedIds || [reply.id]).includes(item.id))
    )

    if (replyTarget?.id === reply.id) { setReplyTarget(null); setComposerOpen(false) }
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

    if (!post || postLikePendingRef.current) return

    postLikePendingRef.current = true
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

    } catch (error) {
      setFeedback(error.message)
    } finally {
      postLikePendingRef.current = false
      setIsLiking(false)
    }
  }

  // ======================================================
  // EDIT AND DELETE POST
  // ======================================================

  function beginEditingPost() {
    setEditTitle(post.title)
    setEditContent(post.content)
    setIsEditingPost(true)
    setFeedback('')
  }

  async function savePost(event) {
    event.preventDefault()

    if (!isOwner || !token || postSavingRef.current) {
      return
    }

    const title = editTitle.trim()
    const content = editContent.trim()

    if (
      title.length < 3 ||
      title.length > 120 ||
      !content ||
      content.length > 10000
    ) {
      setFeedback(
        'Title: 3–120 characters. Content: 1–10000 characters.'
      )
      return
    }

    postSavingRef.current = true
    setIsSavingPost(true)
    setFeedback('')

    try {
      const updated = await updateForumPost(
        post.id,
        {
          title,
          content,
        },
        token,
      )

      invalidateForumFeedCache()

      setPost(updated)
      setIsEditingPost(false)

      setFeedback('Post updated successfully.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      postSavingRef.current = false
      setIsSavingPost(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deletePendingRef.current) return
    deletePendingRef.current = true
    setIsDeleting(true)
    setDeleteError('')
    try {
      if (!token) throw new Error('Please sign in to delete content.')
      if (deleteTarget.reply) {
        await handleDeleteComment(deleteTarget.reply)
        setDeleteTarget(null)
      } else {
        if (!isOwner) throw new Error('Only the post owner can delete it.')
        await deleteForumPost(post.id, token)
        invalidateForumFeedCache()
        setDeleteTarget(null)
        navigate(returnTo, { replace: true, state: { restoreForumFeed: true } })
      }
    } catch (error) {
      setDeleteError(error.message || 'Unable to delete. Please try again.')
    } finally {
      deletePendingRef.current = false
      setIsDeleting(false)
    }
  }

  function renderComposer() {
    return (<form
        className="reply-form"
        onSubmit={addReply}
      >
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
          onCompositionStart={() => { replyCompositionRef.current = true }}
          onCompositionEnd={() => { replyCompositionRef.current = false }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.nativeEvent?.isComposing || replyCompositionRef.current || event.keyCode === 229 || event.nativeEvent?.keyCode === 229) return
            event.preventDefault()
            if (replyText.trim() && !replySubmittingRef.current) void addReply(event)
          }}
          onChange={(event) => {
            setReplyText(event.target.value)
            setFeedback('')
          }}
        />
        <div className="reply-form-actions">
        <button className="reply-target-cancel" type="button" disabled={isSubmittingReply}
          onClick={() => { setReplyTarget(null); setComposerOpen(false) }}>Cancel</button>
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
        </div>
      </form>)
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
          aria-label={`Back to ${returnLabel}`}
          onClick={() => navigate(returnTo)}
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
                onClick={() => navigate(returnTo)}
              >
                Return to {returnLabel}
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
      <DraftNavigationDialog blocker={confirmCancelReply ? { state: 'blocked', reset: () => setConfirmCancelReply(null), proceed: () => { finishReplyEdit(confirmCancelReply); setConfirmCancelReply(null) } } : confirmCancelEdit ? { state: 'blocked', reset: () => setConfirmCancelEdit(false), proceed: () => { setConfirmCancelEdit(false); setIsEditingPost(false); setFeedback('') } } : editBlocker} title="Discard changes?" description="You have unsaved changes. Are you sure you want to leave without saving?" stayLabel="Keep Editing" leaveLabel="Discard Changes" />
      <div className="post-detail-top">
      <button
        className="post-back-button"
        ref={backButtonRef}
        type="button"
        aria-label={`Back to ${returnLabel}`}
        onClick={() => navigate(returnTo, { state: { restoreForumFeed: true } })}
      >
        <ArrowLeft
          size={28}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>

      <div className="post-detail-reading">
      <section className="post-detail-header">
        <div className="post-title-block">
          {channel ? <Link className="post-detail-eyebrow" to={`/forum/channel/${channel.slug}`}>{channel.name}</Link> : <p className="post-detail-eyebrow">{post.game || 'General'}</p>}

          {isEditingPost ? <input className="post-edit-title" form="post-edit-form" aria-label="Post title" value={editTitle} maxLength={120} onChange={event => setEditTitle(event.target.value)} /> : <h1>{post.title}</h1>}
          <p className="post-meta">{authorName}{postTime && ` · ${postTime}`}</p>
        </div>
        <div hidden={isEditingPost}><PostFollowButton postId={post.id} className="post-toolbar-button" /></div>
        {isEditingPost && <span className="post-edit-status">Editing</span>}
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
            <form id="post-edit-form" className="post-edit-form" onSubmit={savePost}>
              <textarea ref={editContentRef} aria-label="Post content" rows={3} value={editContent} maxLength={10000} onChange={event => setEditContent(event.target.value)} />
              <div className="post-edit-actions">
                <button className="reply-target-cancel" type="button" disabled={isSavingPost} onClick={() => { if (editDirty) setConfirmCancelEdit(true); else { setIsEditingPost(false); setFeedback('') } }}>Cancel</button>
                <button className="reply-submit-button" type="submit" disabled={isSavingPost}>{isSavingPost ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          ) : (
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {post.content}
            </p>
          )}
        </article>

        {!isEditingPost && <div
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
              setComposerOpen(!(composerOpen && !replyTarget))
              setReplyTarget(null)
            }}
            aria-label="Reply to post"
          >
            <MessageCircle
              size={16}
              aria-hidden="true"
            />
          </button>
          <details className="post-more-menu" ref={postMenuRef}>
            <summary aria-label="More post actions"><MoreHorizontal size={18} aria-hidden="true" /></summary>
            <div className="post-more-options">
              <button type="button" onClick={(event) => { const details = event.currentTarget.closest('details'); setReportTarget({ commentId: null, focus: details?.querySelector('summary') }); if (details) details.open = false }}><Flag size={15} aria-hidden="true" /> Report</button>
              {isOwner && <button type="button" onClick={() => { if (postMenuRef.current) postMenuRef.current.open = false; beginEditingPost() }}><Pencil size={15} aria-hidden="true" /> Edit</button>}
              {isOwner && <button type="button" onClick={() => { const focus = postMenuRef.current?.querySelector('summary'); if (postMenuRef.current) postMenuRef.current.open = false; setDeleteError(''); setDeleteTarget({ reply: null, focus }) }}><Trash2 size={15} aria-hidden="true" /> Delete</button>}
            </div>
          </details>
        </div>}
      </section>
      {composerOpen && !replyTarget && renderComposer()}

      {/* Database comments */}
      <section
        className="post-replies"
        aria-label="Replies"
        ref={repliesRef}
      >
        <div className="reply-heading" ref={replyHeadingRef}><div className="reply-heading-title"><button className="reply-heading-back" type="button" aria-label={`Back to ${returnLabel} from replies`} aria-hidden={!backAboveViewport} tabIndex={backAboveViewport ? 0 : -1} onClick={() => navigate(returnTo, { state: { restoreForumFeed: true } })}><ArrowLeft size={20} aria-hidden="true" /></button><h2>Replies</h2></div><select aria-label="Sort replies" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Popular</option><option value="oldest">Oldest First</option><option value="newest">Newest First</option></select></div>
        <div className="reply-list">
        {unresolvedReplies.length > 0 && <p role="status">Some replies have missing or invalid parent references and are shown separately.</p>}
        {replies.length === 0 && <p className="post-replies-empty">No replies yet.</p>}
        {roots.map((reply) => (
          <ReplyItem key={reply.id} reply={reply} replies={unresolvedIds.has(reply.id) ? [reply] : replies.filter(item => !unresolvedIds.has(item.id))} newReplyId={newReplyId}
            editDrafts={replyEdits} onBeginEdit={item => setReplyEdits(current => ({ ...current, [item.id]: { original: item.content, text: item.content } }))} onChangeEdit={(id, text) => setReplyEdits(current => ({ ...current, [id]: { ...current[id], text } }))} onCancelEdit={id => { if (replyEdits[id].text !== replyEdits[id].original) setConfirmCancelReply(id); else finishReplyEdit(id) }} onFinishEdit={finishReplyEdit} onReply={handleReply} onEdit={handleEditComment} onDelete={(comment, focus) => { setDeleteError(''); setDeleteTarget({ reply: comment, focus }) }} onReport={(comment, focus) => setReportTarget({ commentId: comment.id, focus })} currentUserId={user?.id} liked={likedComments.includes(reply.id)} likeReady={commentLikeReady} onLike={handleCommentLike} replyTarget={composerOpen ? replyTarget : null} renderComposer={renderComposer} />
        ))}
        </div>
      </section>
      {deleteTarget && <ConfirmationModal title={deleteTarget.reply ? 'Delete this reply?' : 'Delete this post?'} message={deleteTarget.reply ? "This action cannot be undone. Your reply will be removed, but other users' replies will remain visible." : 'This permanently deletes this post and all its replies.'} confirmLabel={deleteTarget.reply ? 'Delete Reply' : 'Delete Post'} destructive busy={isDeleting} error={deleteError} returnFocus={deleteTarget.focus} onCancel={() => { if (!deletePendingRef.current) setDeleteTarget(null) }} onConfirm={confirmDelete} />}
      {reportTarget && <ReportDialog target={reportTarget} onCancel={() => setReportTarget(null)} onSubmit={(payload) => {
        if (!token) throw new Error('Please sign in to report content.')
        return reportForumContent(post.id, reportTarget.commentId, payload, token)
      }} />}


      </div>
      </div>
    </div>
  )
}

export default PostDetail
