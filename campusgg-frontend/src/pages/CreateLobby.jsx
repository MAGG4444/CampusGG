import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import './CreateLobby.css'

const initialFormData = {
  lobbyName: '',
  subtitle: '',
  administratorInput: '',
  administrators: [],
  tags: ['All Categories'],
  details: '',
  participantLimit: 'unlimited',
  visibility: 'public',
}

const tagOptions = ['All Categories', 'Strategy', 'LFG', 'Meta Analysis', 'Tournaments']

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
  const [formData, setFormData] = useState(initialFormData)
  const [, setSavedDraft] = useState(null)
  const [, setPublishedLobby] = useState(null)
  const [errors, setErrors] = useState({})
  const [adminFeedback, setAdminFeedback] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

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
      const nextTags = hasTag ? currentData.tags.filter((selectedTag) => selectedTag !== tag) : [...currentData.tags, tag]

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
      (administrator) => administrator.toLowerCase() === nextAdministrator.toLowerCase(),
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

  function handleSave() {
    setSavedDraft(formData)
    setErrors({})
    setStatusMessage('Draft saved.')
  }

  function validateForm() {
    const nextErrors = {}

    if (!formData.lobbyName.trim()) {
      nextErrors.lobbyName = 'Lobby name is required.'
    } else if (formData.lobbyName.trim().length > maxLobbyNameLength) {
      nextErrors.lobbyName = `Lobby name must be ${maxLobbyNameLength} characters or fewer.`
    }

    if (!formData.details.trim()) {
      nextErrors.details = 'Please enter lobby details.'
    } else if (formData.details.trim().length > maxDetailsLength) {
      nextErrors.details = `Lobby details must be ${maxDetailsLength} characters or fewer.`
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

  function handlePublish(event) {
    event.preventDefault()
    const validationErrors = validateForm()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setStatusMessage('Please fix the highlighted fields.')
      return
    }

    setErrors({})
    setPublishedLobby(formData)
    setStatusMessage('Lobby published successfully.')
  }

  function handleDelete() {
    setFormData(initialFormData)
    setSavedDraft(null)
    setPublishedLobby(null)
    setErrors({})
    setAdminFeedback('')
    setStatusMessage('Lobby cleared.')
  }

  return (
    <div className="create-lobby-wrapper">
      <form className="create-lobby-page" onSubmit={handlePublish}>
        <button className="back-button" type="button" aria-label="Back to Lobby" onClick={() => navigate('/lobby')}>
          &larr;
        </button>

        <div className="create-page-header-row">
          <div className="create-title-fields">
            <label className="sr-only" htmlFor="lobby-name">
              Lobby Name
            </label>
            <input
              className="create-title-input"
              id="lobby-name"
              type="text"
              placeholder="Type Lobby Name"
              value={formData.lobbyName}
              aria-describedby={errors.lobbyName ? 'lobby-name-error' : undefined}
              aria-invalid={errors.lobbyName ? 'true' : 'false'}
              onChange={(event) => updateField('lobbyName', event.target.value)}
            />
            {errors.lobbyName ? (
              <div className="field-error" id="lobby-name-error">
                {errors.lobbyName}
              </div>
            ) : null}

            <label className="sr-only" htmlFor="lobby-subtitle">
              Subtitle
            </label>
            <input
              className="create-subtitle-input"
              id="lobby-subtitle"
              type="text"
              placeholder="Subtitle"
              value={formData.subtitle}
              onChange={(event) => updateField('subtitle', event.target.value)}
            />
          </div>

          <div className="invite-admin-wrap">
            <label className="invite-label" htmlFor="administrator-name">
              Invite Administrator:
            </label>
            <div className="invite-row">
              <input
                className="admin-input"
                id="administrator-name"
                type="text"
                placeholder="User Name"
                value={formData.administratorInput}
                aria-describedby={adminFeedback ? 'administrator-feedback' : undefined}
                onChange={(event) => {
                  updateField('administratorInput', event.target.value)
                  setAdminFeedback('')
                }}
              />
              <button className="small-add-button" type="button" onClick={addAdministrator}>
                + ADD
              </button>
            </div>
            <div className="invite-helper">
              {formData.administrators.length > 0 ? formData.administrators.join(', ') : 'User Names'}
            </div>
            {adminFeedback ? (
              <div className="field-feedback" id="administrator-feedback">
                {adminFeedback}
              </div>
            ) : null}
          </div>
        </div>

        <div className="create-form-group">
          <span className="create-label">Choose Tags:</span>
          <div
            className="tag-row"
            aria-describedby={errors.tags ? 'tags-error' : undefined}
            aria-label="Choose Tags"
          >
            {tagOptions.map((tag) => (
              <button
                className={`mini-chip ${formData.tags.includes(tag) ? 'mini-chip-dark' : ''}`}
                key={tag}
                type="button"
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

        <div className="create-form-group">
          <label className="sr-only" htmlFor="lobby-details">
            Information About this Lobby
          </label>
          <textarea
            className="fake-input fake-input-wide details-input"
            id="lobby-details"
            placeholder="Information About this Lobby...."
            value={formData.details}
            aria-describedby={errors.details ? 'lobby-details-error' : undefined}
            aria-invalid={errors.details ? 'true' : 'false'}
            onChange={(event) => updateField('details', event.target.value)}
          />
          {errors.details ? (
            <div className="field-error" id="lobby-details-error">
              {errors.details}
            </div>
          ) : null}
        </div>

        <div className="create-form-group inline-group">
          <span className="create-label">Participant Limit:</span>
          <div
            className="tag-row"
            aria-describedby={errors.participantLimit ? 'participant-limit-error' : undefined}
            aria-label="Participant Limit"
          >
            {participantLimitOptions.map((option) => (
              <button
                className={`mini-chip ${formData.participantLimit === option.value ? 'mini-chip-dark' : ''}`}
                key={option.value}
                type="button"
                onClick={() => updateField('participantLimit', option.value)}
              >
                {formData.participantLimit === option.value ? '▽ ' : ''}
                {option.label}
              </button>
            ))}
          </div>
          {errors.participantLimit ? (
            <div className="field-error" id="participant-limit-error">
              {errors.participantLimit}
            </div>
          ) : null}
        </div>

        <div className="create-form-group inline-group">
          <span className="create-label">Set Visibility:</span>
          <div
            className="tag-row"
            aria-describedby={errors.visibility ? 'visibility-error' : undefined}
            aria-label="Set Visibility"
          >
            {visibilityOptions.map((option) => (
              <button
                className={`mini-chip ${formData.visibility === option.value ? 'mini-chip-dark' : ''}`}
                key={option.value}
                type="button"
                onClick={() => updateField('visibility', option.value)}
              >
                {formData.visibility === option.value ? '▽ ' : ''}
                {option.label}
              </button>
            ))}
          </div>
          {errors.visibility ? (
            <div className="field-error" id="visibility-error">
              {errors.visibility}
            </div>
          ) : null}
        </div>

        <div className="create-actions">
          <button className="footer-action footer-save" type="button" onClick={handleSave}>
            Save
          </button>
          <button className="footer-action footer-publish" type="submit">
            Publish
          </button>
          <button className="footer-action footer-delete" type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>

        <div className="create-status" aria-live="polite">
          {statusMessage}
        </div>
      </form>
      <img className="create-corner-logo" src={logo} alt="CampusGG logo" />
    </div>
  )
}

export default CreateLobby
