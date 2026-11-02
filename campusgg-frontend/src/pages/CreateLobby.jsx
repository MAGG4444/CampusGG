import { draftEditorReturnTo } from '../utils/myContentNavigation.js'
import { useState } from 'react'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useDraftEditor } from '../hooks/useDraftEditor.js'
import DraftNavigationDialog from '../components/DraftNavigationDialog.jsx'
import GameSelect from '../components/GameSelect.jsx'
import logo from '../assets/LOGO.png'
import './CreateLobby.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const tagOptions = [
  'All Categories',
  'Strategy',
  'LFG',
  'Meta Analysis',
  'Tournaments',
]

const participantLimitOptions = [
  { label: 'Unlimited', value: 'unlimited' },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

const visibilityOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Private', value: 'private' },
  { label: 'Visible to Friends', value: 'friends' },
]

const maxLobbyNameLength = 60
const maxDetailsLength = 500

function CreateLobby() {
  const navigate = useNavigate()
  const location = useLocation()
  // Saving a new draft adds draftId to the URL without changing its entry point.
  const [backPath] = useState(() => draftEditorReturnTo(location, '/lobby'))
  const fromDrafts = backPath === '/my-content?tab=drafts'
  const { token } = useAuth()

  const [errors, setErrors] = useState({})
  const [adminFeedback, setAdminFeedback] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const {
    formData, setFormData, statusMessage, setStatusMessage, blocked,
    hasSavedDraft, save: handleSave, discard, completePublish,
    navigationBlocker,
  } = useDraftEditor('lobby', isPublishing)

  function updateField(field, value) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }))

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }
      delete nextErrors[field]
      return nextErrors
    })

    setStatusMessage('')
  }

  function toggleTag(tag) {
    setFormData((currentData) => {
      const hasTag = currentData.tags.includes(tag)

      const nextTags = hasTag
        ? currentData.tags.filter((selectedTag) => selectedTag !== tag)
        : [...currentData.tags, tag]

      return {
        ...currentData,
        tags: nextTags,
      }
    })

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }
      delete nextErrors.tags
      return nextErrors
    })

    setStatusMessage('')
  }

  function addAdministrator() {
    const nextAdministrator = formData.administratorInput.trim()

    if (!nextAdministrator) {
      setAdminFeedback('Enter an administrator name.')
      return
    }

    const alreadyAdded = formData.administrators.some(
      (administrator) =>
        administrator.toLowerCase() === nextAdministrator.toLowerCase(),
    )

    if (alreadyAdded) {
      setAdminFeedback('Administrator already added.')
      return
    }

    setFormData((currentData) => ({
      ...currentData,
      administratorInput: '',
      administrators: [...currentData.administrators, nextAdministrator],
    }))

    setAdminFeedback('Administrator added.')
  }

  function validateForm() {
    const nextErrors = {}

    if (!formData.lobbyName.trim()) {
      nextErrors.lobbyName = 'Lobby name is required.'
    } else if (formData.lobbyName.trim().length > maxLobbyNameLength) {
      nextErrors.lobbyName =
        `Lobby name must be ${maxLobbyNameLength} characters or fewer.`
    }

    if (!formData.details.trim()) {
      nextErrors.details = 'Please enter lobby details.'
    } else if (formData.details.trim().length > maxDetailsLength) {
      nextErrors.details =
        `Lobby details must be ${maxDetailsLength} characters or fewer.`
    }

    if (formData.game.trim().length > 50) {
      nextErrors.game = 'Game must be at most 50 characters.'
    }

    if (formData.tags.length === 0) {
      nextErrors.tags = 'Please select at least one tag.'
    }

    if (!formData.participantLimit) {
      nextErrors.participantLimit = 'Please choose a participant limit.'
    }

    if (!formData.visibility) {
      nextErrors.visibility = 'Please choose a visibility option.'
    }

    return nextErrors
  }

  // ============================================================
  // PUBLISH LOBBY TO POSTGRESQL
  // ============================================================

  async function handlePublish(event) {
    event.preventDefault()

    if (blocked) return

    if (isPublishing) {
      return
    }

    const validationErrors = validateForm()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setStatusMessage('Please fix the highlighted fields.')
      return
    }

    if (!token) {
      setStatusMessage('Please sign in before publishing a lobby.')
      return
    }

    setErrors({})
    setStatusMessage('')
    setIsPublishing(true)

    try {
      // "All Categories" is a UI option, not an actual lobby tag.
      const selectedTags = formData.tags.filter(
        (tag) => tag !== 'All Categories',
      )

      // Map existing frontend fields to the backend CreateLobbyDto.
      const lobbyData = {
        lobbyName: formData.lobbyName.trim(),
        details: formData.details.trim(),
        visibility: formData.visibility,

        ...(formData.game.trim()
          ? { game: formData.game.trim() }
          : {}),

        ...(formData.subtitle.trim()
          ? { subtitle: formData.subtitle.trim() }
          : {}),

        ...(selectedTags.length > 0
          ? { tags: selectedTags }
          : {}),

        // Omit participantLimit for unlimited lobbies.
        ...(formData.participantLimit !== 'unlimited'
          ? { participantLimit: formData.participantLimit }
          : {}),
      }

      // The backend identifies the host from the JWT.
      const response = await fetch(`${API_URL}/lobbies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(lobbyData),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            'Your login session has expired. Please sign in again.',
          )
        }

        const message = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message

        throw new Error(message || 'Unable to publish lobby.')
      }

      completePublish()

      // Lobby was successfully created in PostgreSQL.
      setStatusMessage('Lobby published successfully.')

      // Return to the lobby feed, which fetches real database records.
      navigate('/lobby')
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Unable to publish lobby. Please try again.',
      )
    } finally {
      setIsPublishing(false)
    }
  }

  function handleDelete() {
    if (!discard()) return
    setErrors({})
    setAdminFeedback('')
  }

  return (
    <div className="create-lobby-wrapper page-enter">
      <DraftNavigationDialog blocker={navigationBlocker} />
      <form className="create-lobby-page create-lobby-editor-page" onSubmit={handlePublish}>
        <div className="create-topbar">
          <button
            className="back-button"
            type="button"
            aria-label={fromDrafts ? 'Back to My Drafts' : backPath.startsWith('/my-content?') ? 'Back to My Content' : 'Back to Lobby'}
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft size={26} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <header className="create-flow-heading create-editor-heading">
          <div className="create-flow-copy">
            <p className="page-kicker">New lobby</p>
            <h1>Create a lobby</h1>
            <p>Set up a space for your next session.</p>
          </div>
          <Link className="editor-drafts-link" to="/my-content?tab=drafts">
            <FilePenLine size={17} aria-hidden="true" />
            My Drafts
          </Link>
        </header>

        <div className="create-page-header-row">
          <div className="create-title-fields">
            <label
              className="create-field-label"
              htmlFor="lobby-name"
            >
              Lobby name
            </label>

            <input
              className="create-title-input"
              id="lobby-name"
              type="text"
              placeholder="Lobby name"
              value={formData.lobbyName}
              aria-describedby={
                errors.lobbyName ? 'lobby-name-error' : undefined
              }
              aria-invalid={Boolean(errors.lobbyName)}
              onChange={(event) =>
                updateField('lobbyName', event.target.value)
              }
            />

            {errors.lobbyName ? (
              <div className="field-error" id="lobby-name-error">
                {errors.lobbyName}
              </div>
            ) : null}

            <label
              className="create-field-label"
              htmlFor="lobby-subtitle"
            >
              Short description
            </label>

            <input
              className="create-subtitle-input"
              id="lobby-subtitle"
              type="text"
              placeholder="Short summary"
              value={formData.subtitle}
              onChange={(event) =>
                updateField('subtitle', event.target.value)
              }
            />
          </div>

        </div>

        <div className="create-form-group create-details-group">
          <label
            className="create-field-label"
            htmlFor="lobby-details"
          >
            Description
          </label>

          <textarea
            className="fake-input fake-input-wide details-input"
            id="lobby-details"
            placeholder="What should players know?"
            value={formData.details}
            aria-describedby={
              errors.details ? 'lobby-details-error' : undefined
            }
            aria-invalid={Boolean(errors.details)}
            onChange={(event) =>
              updateField('details', event.target.value)
            }
          />

          {errors.details ? (
            <div
              className="field-error"
              id="lobby-details-error"
            >
              {errors.details}
            </div>
          ) : null}
        </div>

        <aside className="create-lobby-settings-panel" aria-label="Lobby settings">
        <div className="create-form-group create-settings-section create-game-group">
          <label className="create-field-label" htmlFor="lobby-game">
            Game <span>(optional)</span>
          </label>
          <GameSelect
            id="lobby-game"
            value={formData.game}
            invalid={Boolean(errors.game)}
            onChange={(game) => updateField('game', game)}
          />
          {errors.game ? (
            <div className="field-error" role="alert">{errors.game}</div>
          ) : null}
        </div>

        <div className="create-form-group create-settings-section create-tags-group">
          <span className="create-label">Tags</span>

          <div
            className="tag-row"
            aria-describedby={
              errors.tags ? 'tags-error' : undefined
            }
            aria-label="Choose Tags"
          >
            {tagOptions.map((tag) => (
              <button
                className={`mini-chip ${
                  formData.tags.includes(tag)
                    ? 'mini-chip-dark'
                    : ''
                }`}
                key={tag}
                type="button"
                aria-pressed={formData.tags.includes(tag)}
                onClick={() => toggleTag(tag)}
              >
                {formData.tags.includes(tag) ? '▽ ' : ''}
                {tag}
              </button>
            ))}
          </div>

          {errors.tags ? (
            <div className="field-error" id="tags-error">
              {errors.tags}
            </div>
          ) : null}
        </div>

        <div className="create-form-group inline-group create-settings-section create-limit-group">
          <span className="create-label">Max players</span>

          <div
            className="tag-row"
            aria-describedby={
              errors.participantLimit
                ? 'participant-limit-error'
                : undefined
            }
            aria-label="Participant Limit"
          >
            {participantLimitOptions.map((option) => (
              <button
                className={`mini-chip ${
                  formData.participantLimit === option.value
                    ? 'mini-chip-dark'
                    : ''
                }`}
                key={option.value}
                type="button"
                aria-pressed={
                  formData.participantLimit === option.value
                }
                onClick={() =>
                  updateField('participantLimit', option.value)
                }
              >
                {formData.participantLimit === option.value
                  ? '▽ '
                  : ''}
                {option.label}
              </button>
            ))}
          </div>

          {errors.participantLimit ? (
            <div
              className="field-error"
              id="participant-limit-error"
            >
              {errors.participantLimit}
            </div>
          ) : null}
        </div>

        <div className="create-form-group inline-group create-settings-section create-visibility-group">
          <span className="create-label">Visibility</span>

          <div
            className="tag-row"
            aria-describedby={
              errors.visibility
                ? 'visibility-error'
                : undefined
            }
            aria-label="Set Visibility"
          >
            {visibilityOptions.map((option) => (
              <button
                className={`mini-chip ${
                  formData.visibility === option.value
                    ? 'mini-chip-dark'
                    : ''
                }`}
                key={option.value}
                type="button"
                aria-pressed={
                  formData.visibility === option.value
                }
                onClick={() =>
                  updateField('visibility', option.value)
                }
              >
                {formData.visibility === option.value
                  ? '▽ '
                  : ''}
                {option.label}
              </button>
            ))}
          </div>

          {errors.visibility ? (
            <div
              className="field-error"
              id="visibility-error"
            >
              {errors.visibility}
            </div>
          ) : null}
        </div>
        </aside>

        <details className="invite-admin-wrap create-admin-group">
          <summary className="admin-summary">
            <span>Administrators <span>(optional)</span></span>
            <span className="admin-draft-note">Draft only</span>
          </summary>
          <div className="admin-content">
            <label
              className="invite-label"
              htmlFor="administrator-name"
            >
              Username
            </label>

            <div className="invite-row">
              <input
                className="admin-input"
                id="administrator-name"
                type="text"
                placeholder="Username"
                value={formData.administratorInput}
                aria-describedby={
                  adminFeedback
                    ? 'administrator-feedback'
                    : undefined
                }
                onChange={(event) => {
                  updateField(
                    'administratorInput',
                    event.target.value,
                  )
                  setAdminFeedback('')
                }}
              />

              <button
                className="small-add-button"
                type="button"
                onClick={addAdministrator}
              >
                Add
              </button>
            </div>

            <div className="invite-helper">
              {formData.administrators.length > 0
                ? formData.administrators.join(', ')
                : 'No administrators selected.'}
            </div>

            {adminFeedback ? (
              <div
                className="field-feedback"
                id="administrator-feedback"
              >
                {adminFeedback}
              </div>
            ) : null}
          </div>
        </details>

        <div className="create-actions">
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
            {isPublishing ? 'Creating...' : 'Create Lobby'}
          </button>
        </div>

        <div
          className="create-status"
          aria-atomic="true"
          aria-live="polite"
          role={statusMessage.includes('Unable') ? 'alert' : 'status'}
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

export default CreateLobby
