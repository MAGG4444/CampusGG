import { draftEditorReturnTo } from '../utils/myContentNavigation.js'

import { useRef, useState } from 'react'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../context/useAuth.js'
import { useDraftEditor } from '../hooks/useDraftEditor.js'
import DraftNavigationDialog from '../components/DraftNavigationDialog.jsx'
import { createForumPost } from '../api/forum.js'
import { useForumChannels } from '../context/forumChannelsContext.js'
import { invalidateForumFeedCache } from '../hooks/useInfiniteForumFeed.js'

import './CreateLobby.css'
import './CreatePost.css'

function CreatePostEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams()
  // Saving a new draft adds draftId to the URL without changing its entry point.
  const [backPath] = useState(() => draftEditorReturnTo(location, '/forum'))
  const fromDrafts = backPath === '/my-content?tab=drafts'
  const { token } = useAuth()

  const { channels, error: channelError, retry: retryChannels } = useForumChannels()

  const [errors, setErrors] = useState({})
  const [isPublishing, setIsPublishing] = useState(false)
  const publishingRef = useRef(false)
  const {
    formData, setFormData, statusMessage, setStatusMessage, blocked,
    hasSavedDraft, save: handleSave, discard, completePublish,
    navigationBlocker,
  } = useDraftEditor('post', isPublishing, { channelSlug: slug || '' })

  const channel = channels?.find((item) => item.slug === formData.channelSlug) ||
    (!formData.channelSlug && formData.game ? channels?.find((item) => item.aliases?.includes(formData.game.trim().toLowerCase())) : null)
  const channelMismatch = Boolean(slug && channel && channel.slug !== slug)
  const canPublishChannel = Boolean(channel && !channelMismatch && (!slug || channel.slug === slug))

  function updateField(field, value) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }))

    setStatusMessage('')
  }

  function validateForm() {
    const next = {}

    if (formData.title.trim().length < 3) {
      next.title = 'Title must be at least 3 characters.'
    }

    if (!formData.content.trim()) {
      next.content = 'Post content is required.'
    }

    if (formData.content.trim().length > 10000) {
      next.content = 'Post content must be 10,000 characters or less.'
    }

    if (!canPublishChannel) next.game = 'Choose a valid game channel before publishing.'

    return next
  }

  async function handlePublish(event) {
    event.preventDefault()

    if (blocked || publishingRef.current) return

    const nextErrors = validateForm()

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setStatusMessage('Correct the highlighted fields.')
      return
    }

    if (!token) {
      setStatusMessage(
        'Please sign in before publishing a post.'
      )
      return
    }

    publishingRef.current = true
    setIsPublishing(true)
    setStatusMessage('')

    try {
      const post = await createForumPost(
        {
          title: formData.title.trim(),
          content: formData.content.trim(),
          channelSlug: channel.slug,
        },
        token
      )

      invalidateForumFeedCache()
      completePublish()

      navigate(`/forum/${post.id}`, {
        replace: true,
      })
    } catch (error) {
      setStatusMessage(
        error.message || 'Unable to publish post.'
      )
    } finally {
      publishingRef.current = false
      setIsPublishing(false)
    }
  }

  function handleDelete() {
    if (!discard()) return
    setErrors({})
  }

  return (
    <div className="create-lobby-wrapper create-post-wrapper page-enter">
      <DraftNavigationDialog blocker={navigationBlocker} />
      <form
        className="create-lobby-page create-post-page"
        onSubmit={handlePublish}
      >
        <header className="create-post-header">
          <button
            className="back-button create-post-back-button"
            type="button"
            aria-label={fromDrafts ? 'Back to My Drafts' : backPath.startsWith('/my-content?') ? 'Back to My Content' : 'Back to Forum'}
            onClick={() => navigate(backPath === '/forum' && slug ? `/forum/channel/${slug}` : backPath)}
          >
            <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <div className="create-post-title-main">
            <label className="sr-only" htmlFor="post-title">Post title</label>
            <input
              className="create-title-input"
              id="post-title"
              type="text"
              placeholder="Type a title"
              value={formData.title}
              maxLength={100}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'post-title-error' : undefined}
              onChange={(event) => updateField('title', event.target.value)}
            />
            {errors.title && <div id="post-title-error" className="field-error" role="alert">{errors.title}</div>}
          </div>
          <div className="create-post-channel-control">
            <label className="sr-only" htmlFor="post-channel">Post channel</label>
            {slug ? <input id="post-channel" className={`create-post-channel-input ${channel && !channelMismatch ? 'is-selected' : ''}`} value={channel && !channelMismatch ? channel.name : ''} placeholder="Channel unavailable" readOnly /> : <select id="post-channel" className={`create-post-channel-input ${channel ? 'is-selected' : ''}`} required value={channel?.slug || ''} onChange={(event) => { updateField('channelSlug', event.target.value); setFormData((current) => ({ ...current, game: '' })) }}>
              <option value="">Post Channel</option>
              {(channels || []).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>}
          </div>
          <Link className="editor-drafts-link" to="/my-content?tab=drafts">
            <FilePenLine size={17} aria-hidden="true" />
            My Drafts
          </Link>
        </header>

        {(channelError || !channels || channels.length === 0 || (slug && (channelMismatch || !channel)) || errors.game) && <div className="create-post-channel-status">
            {channelError ? <p role="alert">{channelError} <button type="button" onClick={retryChannels}>Retry</button></p> : !channels ? <p role="status">Loading channels...</p> : channels.length === 0 ? <p>No game channels are available. <button type="button" onClick={retryChannels}>Retry</button></p> : slug && channelMismatch ? <p role="alert">This draft belongs to {channel.name}. Open it from My Drafts to preserve its channel.</p> : slug && !channel ? <p role="alert">Channel unavailable or draft channel unrecognized. Open the draft from My Drafts to select a channel.</p> : null}
            {errors.game && <div className="field-error" role="alert">{errors.game}</div>}
        </div>}

        <div className="create-form-group create-post-content-group">
          <label
            className="sr-only"
            htmlFor="post-content"
          >
            Post content
          </label>

          <textarea
            className="create-post-content-input"
            id="post-content"
            maxLength={5000}
            placeholder="Write your post..."
            value={formData.content}
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? 'post-content-error' : undefined}
            onChange={(event) =>
              updateField('content', event.target.value)
            }
          />

          {errors.content && (
            <div id="post-content-error" className="field-error" role="alert">
              {errors.content}
            </div>
          )}
        </div>

        <div className="create-actions create-post-actions">
          {hasSavedDraft && (
            <button
              className="footer-action footer-delete"
              type="button"
              onClick={handleDelete}
              disabled={isPublishing}
            >
              Delete draft
            </button>
          )}
          <button
            className="footer-action footer-save"
            type="button"
            onClick={handleSave}
            disabled={isPublishing || blocked}
          >
            Save Draft
          </button>

          <button
            className="footer-action footer-publish"
            type="submit"
            disabled={isPublishing || blocked || !canPublishChannel}
          >
            {isPublishing
              ? 'Publishing...'
              : 'Publish'}
          </button>

        </div>

        <div
          className="create-status"
          aria-atomic="true"
          role={statusMessage.includes('Unable') ? 'alert' : 'status'}
          aria-live="polite"
        >
          {statusMessage}
        </div>
      </form>

    </div>
  )
}

export default function CreatePost() {
  const { slug } = useParams()
  return <CreatePostEditor key={slug || 'global'} />
}
