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

function CreateLobby() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialFormData)
  const [, setSavedDraft] = useState(null)
  const [, setPublishedLobby] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')

  function updateField(field, value) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }))
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
  }

  function addAdministrator() {
    const nextAdministrator = formData.administratorInput.trim()

    if (!nextAdministrator) {
      return
    }

    setFormData((currentData) => ({
      ...currentData,
      administratorInput: '',
      administrators: [...currentData.administrators, nextAdministrator],
    }))
  }

  function handleSave() {
    setSavedDraft(formData)
    setStatusMessage('Draft saved')
  }

  function handlePublish(event) {
    event.preventDefault()
    setPublishedLobby(formData)
    setStatusMessage('Lobby ready to publish')
  }

  function handleDelete() {
    setFormData(initialFormData)
    setSavedDraft(null)
    setPublishedLobby(null)
    setStatusMessage('Lobby cleared')
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
              onChange={(event) => updateField('lobbyName', event.target.value)}
            />

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
                onChange={(event) => updateField('administratorInput', event.target.value)}
              />
              <button className="small-add-button" type="button" onClick={addAdministrator}>
                + ADD
              </button>
            </div>
            <div className="invite-helper">
              {formData.administrators.length > 0 ? formData.administrators.join(', ') : 'User Names'}
            </div>
          </div>
        </div>

        <div className="create-form-group">
          <span className="create-label">Choose Tags:</span>
          <div className="tag-row" aria-label="Choose Tags">
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
            onChange={(event) => updateField('details', event.target.value)}
          />
        </div>

        <div className="create-form-group inline-group">
          <span className="create-label">Participant Limit:</span>
          <div className="tag-row" aria-label="Participant Limit">
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
        </div>

        <div className="create-form-group inline-group">
          <span className="create-label">Set Visibility:</span>
          <div className="tag-row" aria-label="Set Visibility">
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
