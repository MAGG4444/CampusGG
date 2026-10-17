
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth.js'
import { createForumPost } from '../api/forum.js'

import logo from '../assets/LOGO.png'

import './CreateLobby.css'
import './CreatePost.css'

const DRAFT_KEY = 'campusgg-forum-draft'

const initialFormData = {
  title: '',
  subtitle: '',
  tag: 'All Categories',
  game: '',
  content: '',
  visibility: 'Public',
}

const tagOptions = [
  'All Categories',
  'Strategy',
  'LFG',
  'Meta Analysis',
  'Tournaments',
]

const visibilityOptions = [
  'Public',
  'Private',
  'Visible to Lobby Members',
]

function getSavedDraft() {
  try {
    const value = JSON.parse(
      localStorage.getItem(DRAFT_KEY) || 'null'
    )

    return value && typeof value === 'object'
      ? { ...initialFormData, ...value }
      : initialFormData
  } catch {
    return initialFormData
  }
}

function CreatePost() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [formData, setFormData] = useState(getSavedDraft)
  const [errors, setErrors] = useState({})
  const [statusMessage, setStatusMessage] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

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

  function handleSave() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(formData)
      )

      setStatusMessage(
        'Draft saved locally on this browser (not published).'
      )
    } catch {
      setStatusMessage(
        'Unable to save draft in this browser.'
      )
    }
  }

  function validateForm() {
    const next = {}

    if (formData.title.trim().length < 3) {
      next.title = 'Title must be at least 3 characters.'
    }

    if (!formData.content.trim()) {
      next.content = 'Post content is required.'
    }

    const fullContent = [
      formData.subtitle.trim(),
      formData.content.trim(),
    ]
      .filter(Boolean)
      .join('\n\n')

    if (fullContent.length > 10000) {
      next.content =
        'The combined description and content must be 10,000 characters or less.'
    }

    if (formData.game.trim().length > 50) {
      next.game = 'Game must be at most 50 characters.'
    }

    return next
  }

  async function handlePublish(event) {
    event.preventDefault()

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
      // Include the short description in the content
      // because the backend has no separate subtitle column.
      const content = [
        formData.subtitle.trim(),
        formData.content.trim(),
      ]
        .filter(Boolean)
        .join('\n\n')

      const post = await createForumPost(
        {
          title: formData.title.trim(),
          content,
          game: formData.game.trim() || undefined,
        },
        token
      )

      localStorage.removeItem(DRAFT_KEY)

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
    if (
      !window.confirm(
        'Clear this form and remove the locally saved draft?'
      )
    ) {
      return
    }

    setFormData({ ...initialFormData })
    localStorage.removeItem(DRAFT_KEY)
    setErrors({})

    setStatusMessage(
      'Draft cleared. No published post was deleted.'
    )
  }

  return (
    <div className="create-lobby-wrapper page-enter">
      <form
        className="create-lobby-page create-post-page"
        onSubmit={handlePublish}
      >
        <button
          className="back-button create-post-back-button"
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

        <header className="create-flow-heading">
          <p className="page-kicker">
            Start a conversation
          </p>

          <h1>Create a forum post</h1>

          <p>
            Ask a question, share an insight, or bring
            the campus gaming community together
            around an idea.
          </p>
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
            placeholder="Write a title that gets to the point"
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

          <label
            className="create-field-label"
            htmlFor="post-subtitle"
          >
            Short description
          </label>

          <input
            className="create-subtitle-input"
            id="post-subtitle"
            type="text"
            placeholder="Add context for readers scanning the forum"
            value={formData.subtitle}
            maxLength={150}
            onChange={(event) =>
              updateField('subtitle', event.target.value)
            }
          />

          <small>
            The short description is included at the
            start of your post content.
          </small>

          <label
            className="create-field-label"
            htmlFor="post-game"
          >
            Game (optional)
          </label>

          <input
            className="create-subtitle-input"
            id="post-game"
            type="text"
            maxLength={50}
            placeholder="e.g. Valorant"
            value={formData.game}
            onChange={(event) =>
              updateField('game', event.target.value)
            }
          />

          {errors.game && (
            <div className="field-error" role="alert">
              {errors.game}
            </div>
          )}
        </div>

        <div className="create-form-group">
          <span className="create-label">
            Choose Tag:
          </span>

          <div
            className="tag-row"
            role="group"
            aria-label="Choose Tag"
          >
            {tagOptions.map((tag) => (
              <button
                className={`mini-chip ${
                  formData.tag === tag
                    ? 'mini-chip-dark'
                    : ''
                }`}
                key={tag}
                type="button"
                aria-pressed={formData.tag === tag}
                onClick={() =>
                  updateField('tag', tag)
                }
              >
                {formData.tag === tag ? '✓ ' : ''}
                {tag}
              </button>
            ))}
          </div>

          <small>
            Tags remain in your local draft; the
            backend doesn't store categories yet.
          </small>
        </div>

        <div className="create-form-group">
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
            placeholder="Share the details with the community..."
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

        <div className="create-form-group inline-group">
          <span className="create-label">
            Set Visibility:
          </span>

          <div
            className="tag-row"
            aria-label="Set Visibility"
          >
            {visibilityOptions.map((visibility) => (
              <button
                className={`mini-chip ${
                  formData.visibility === visibility
                    ? 'mini-chip-dark'
                    : ''
                }`}
                key={visibility}
                type="button"
                aria-pressed={
                  formData.visibility === visibility
                }
                disabled={visibility !== 'Public'}
                title={
                  visibility !== 'Public'
                    ? 'Backend access controls for private posts are not implemented yet'
                    : ''
                }
                onClick={() =>
                  updateField('visibility', visibility)
                }
              >
                {formData.visibility === visibility
                  ? '✓ '
                  : ''}
                {visibility}
              </button>
            ))}
          </div>

          <small>
            Only public posts can be published until
            private-post authorization is implemented.
          </small>
        </div>

        <div className="create-actions create-post-actions">
          <button
            className="footer-action footer-save"
            type="button"
            onClick={handleSave}
            disabled={isPublishing}
          >
            Save
          </button>

          <button
            className="footer-action footer-publish"
            type="submit"
            disabled={isPublishing}
          >
            {isPublishing
              ? 'Publishing...'
              : 'Publish'}
          </button>

          <button
            className="footer-action footer-delete"
            type="button"
            onClick={handleDelete}
            disabled={isPublishing}
          >
            Delete
          </button>
        </div>

        <div
          className="create-status"
          role="status"
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
