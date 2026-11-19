import { draftEditorReturnTo } from '../utils/myContentNavigation.js'

import { useState } from 'react'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth.js'
import { useDraftEditor } from '../hooks/useDraftEditor.js'
import DraftNavigationDialog from '../components/DraftNavigationDialog.jsx'
import GameSelect from '../components/GameSelect.jsx'
import { createForumPost } from '../api/forum.js'

import logo from '../assets/LOGO.png'

import './CreateLobby.css'
import './CreatePost.css'

function CreatePost() {
  const navigate = useNavigate()
  const location = useLocation()
  // Saving a new draft adds draftId to the URL without changing its entry point.
  const [backPath] = useState(() => draftEditorReturnTo(location, '/forum'))
  const fromDrafts = backPath === '/my-content?tab=drafts'
  const { token } = useAuth()

  const [errors, setErrors] = useState({})
  const [isPublishing, setIsPublishing] = useState(false)
  const {
    formData, setFormData, statusMessage, setStatusMessage, blocked,
    hasSavedDraft, save: handleSave, discard, completePublish,
    navigationBlocker,
  } = useDraftEditor('post', isPublishing)

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

    if (formData.game.trim().length > 50) {
      next.game = 'Game must be at most 50 characters.'
    }

    return next
  }

  async function handlePublish(event) {
    event.preventDefault()

    if (blocked || isPublishing) return

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

    setIsPublishing(true)
    setStatusMessage('')

    try {
      const post = await createForumPost(
        {
          title: formData.title.trim(),
          content: formData.content.trim(),
          game: formData.game.trim() || undefined,
        },
        token
      )

      completePublish()

      navigate(`/forum/${post.id}`, {
        replace: true,
      })
    } catch (error) {
      setStatusMessage(
        error.message || 'Unable to publish post.'
      )
    } finally {
      setIsPublishing(false)
    }
  }

  function handleDelete() {
    if (!discard()) return
    setErrors({})
  }

  return (
    <div className="create-lobby-wrapper page-enter">
      <DraftNavigationDialog blocker={navigationBlocker} />
      <form
        className="create-lobby-page create-post-page"
        onSubmit={handlePublish}
      >
        <div className="create-topbar">
          <button
            className="back-button create-post-back-button"
            type="button"
            aria-label={fromDrafts ? 'Back to My Drafts' : backPath.startsWith('/my-content?') ? 'Back to My Content' : 'Back to Forum'}
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <header className="create-flow-heading create-editor-heading">
          <div className="create-flow-copy">
            <p className="page-kicker">Start a conversation</p>
            <h1>Create a forum post</h1>
            <p>Share with the campus gaming community.</p>
          </div>
          <Link className="editor-drafts-link" to="/my-content?tab=drafts">
            <FilePenLine size={17} aria-hidden="true" />
            My Drafts
          </Link>
        </header>

        <div className="create-title-fields create-post-title-fields">
          <label
            className="create-field-label"
            htmlFor="post-title"
          >
            Post title
          </label>

          <input
            className="create-title-input"
            id="post-title"
            type="text"
            placeholder="Post title"
            value={formData.title}
            maxLength={100}
            aria-invalid={Boolean(errors.title)}
            onChange={(event) =>
              updateField('title', event.target.value)
            }
          />

          {errors.title && (
            <div className="field-error" role="alert">
              {errors.title}
            </div>
          )}

          <div className="create-post-game-field">
            <label className="create-field-label" htmlFor="post-game">
              Game <span>(optional)</span>
            </label>
            <GameSelect
              id="post-game"
              value={formData.game}
              invalid={Boolean(errors.game)}
              onChange={(game) => updateField('game', game)}
            />
            {errors.game && (
              <div className="field-error" role="alert">{errors.game}</div>
            )}
          </div>
        </div>

        <div className="create-form-group create-post-content-group">
          <label
            className="create-field-label"
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
            onChange={(event) =>
              updateField('content', event.target.value)
            }
          />

          {errors.content && (
            <div className="field-error" role="alert">
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
            disabled={isPublishing || blocked}
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

      <img
        className="create-corner-logo"
        src={logo}
        alt="CampusGG logo"
      />
    </div>
  )
}

export default CreatePost
