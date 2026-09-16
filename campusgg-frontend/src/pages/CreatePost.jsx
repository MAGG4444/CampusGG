import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import './CreateLobby.css'
import './CreatePost.css'

const initialFormData = {
  title: '',
  subtitle: '',
  tag: 'All Categories',
  content: '',
  visibility: 'Public',
}

const tagOptions = ['All Categories', 'Strategy', 'LFG', 'Meta Analysis', 'Tournaments']
const visibilityOptions = ['Public', 'Private', 'Visible to Lobby Members']

function CreatePost() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialFormData)
  const [, setSavedDraft] = useState(null)
  const [, setPublishedPost] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')

  function updateField(field, value) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }))
    setStatusMessage('')
  }

  function handleSave() {
    setSavedDraft(formData)
    setStatusMessage('Draft saved.')
  }

  function handlePublish(event) {
    event.preventDefault()
    setPublishedPost(formData)
    setStatusMessage('Post ready to publish.')
  }

  function handleDelete() {
    setFormData(initialFormData)
    setSavedDraft(null)
    setPublishedPost(null)
    setStatusMessage('Post cleared.')
  }

  return (
    <div className="create-lobby-wrapper">
      <form className="create-lobby-page create-post-page" onSubmit={handlePublish}>
        <button className="back-button create-post-back-button" type="button" aria-label="Back to Forum" onClick={() => navigate('/forum')}>
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <div className="create-title-fields create-post-title-fields">
          <label className="sr-only" htmlFor="post-title">
            Post Title
          </label>
          <input
            className="create-title-input"
            id="post-title"
            type="text"
            placeholder="Type Title"
            value={formData.title}
            onChange={(event) => updateField('title', event.target.value)}
          />

          <label className="sr-only" htmlFor="post-subtitle">
            Subtitle
          </label>
          <input
            className="create-subtitle-input"
            id="post-subtitle"
            type="text"
            placeholder="Subtitle"
            value={formData.subtitle}
            onChange={(event) => updateField('subtitle', event.target.value)}
          />
        </div>

        <div className="create-form-group">
          <span className="create-label">Choose Tag:</span>
          <div className="tag-row" aria-label="Choose Tag">
            {tagOptions.map((tag) => (
              <button
                className={`mini-chip ${formData.tag === tag ? 'mini-chip-dark' : ''}`}
                key={tag}
                type="button"
                onClick={() => updateField('tag', tag)}
              >
                {formData.tag === tag ? '✓ ' : ''}
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="create-form-group">
          <label className="sr-only" htmlFor="post-content">
            Post Content
          </label>
          <textarea
            className="create-post-content-input"
            id="post-content"
            placeholder="Text"
            value={formData.content}
            onChange={(event) => updateField('content', event.target.value)}
          />
        </div>

        <div className="create-form-group inline-group">
          <span className="create-label">Set Visibility:</span>
          <div className="tag-row" aria-label="Set Visibility">
            {visibilityOptions.map((visibility) => (
              <button
                className={`mini-chip ${formData.visibility === visibility ? 'mini-chip-dark' : ''}`}
                key={visibility}
                type="button"
                onClick={() => updateField('visibility', visibility)}
              >
                {formData.visibility === visibility ? '✓ ' : ''}
                {visibility}
              </button>
            ))}
          </div>
        </div>

        <div className="create-actions create-post-actions">
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

export default CreatePost
