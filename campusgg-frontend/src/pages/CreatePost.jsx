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
const validPostTags = tagOptions.filter((tag) => tag !== 'All Categories')
const visibilityOptions = ['Public', 'Private', 'Visible to Lobby Members']
const maxTitleLength = 100
const maxSubtitleLength = 150
const maxContentLength = 5000

function CreatePost() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialFormData)
  const [, setSavedDraft] = useState(null)
  const [, setPublishedPost] = useState(null)
  const [errors, setErrors] = useState({})
  const [statusMessage, setStatusMessage] = useState('')

  function updateField(field, value) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }))
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }

      if ((field === 'title' || field === 'content') && value.trim()) {
        delete nextErrors[field]
      }

      if (field === 'tag' && validPostTags.includes(value)) {
        delete nextErrors.tag
      }

      return nextErrors
    })
    setStatusMessage('')
  }

  function handleSave() {
    setSavedDraft(formData)
    setErrors({})
    setStatusMessage('Draft saved.')
  }

  function validateForm() {
    const nextErrors = {}

    if (!formData.title.trim()) {
      nextErrors.title = 'Post title is required.'
    }

    if (!validPostTags.includes(formData.tag)) {
      nextErrors.tag = 'Please select a tag.'
    }

    if (!formData.content.trim()) {
      nextErrors.content = 'Post content is required.'
    }

    return nextErrors
  }

  function handlePublish(event) {
    event.preventDefault()

    const validationErrors = validateForm()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setStatusMessage('')
      return
    }

    setErrors({})
    setPublishedPost(formData)
    setStatusMessage('Post published successfully.')
  }

  function handleDelete() {
    setFormData(initialFormData)
    setSavedDraft(null)
    setPublishedPost(null)
    setErrors({})
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
            maxLength={maxTitleLength}
            aria-describedby={errors.title ? 'post-title-error' : undefined}
            aria-invalid={errors.title ? 'true' : 'false'}
            onChange={(event) => updateField('title', event.target.value)}
          />
          {errors.title ? (
            <div className="field-error" id="post-title-error">
              {errors.title}
            </div>
          ) : null}

          <label className="sr-only" htmlFor="post-subtitle">
            Subtitle
          </label>
          <input
            className="create-subtitle-input"
            id="post-subtitle"
            type="text"
            placeholder="Subtitle"
            value={formData.subtitle}
            maxLength={maxSubtitleLength}
            onChange={(event) => updateField('subtitle', event.target.value)}
          />
        </div>

        <div className="create-form-group">
          <span className="create-label">Choose Tag:</span>
          <div
            className="tag-row"
            role="group"
            aria-describedby={errors.tag ? 'post-tag-error' : undefined}
            aria-invalid={errors.tag ? 'true' : 'false'}
            aria-label="Choose Tag"
          >
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
          {errors.tag ? (
            <div className="field-error" id="post-tag-error">
              {errors.tag}
            </div>
          ) : null}
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
            maxLength={maxContentLength}
            aria-describedby={errors.content ? 'post-content-error' : undefined}
            aria-invalid={errors.content ? 'true' : 'false'}
            onChange={(event) => updateField('content', event.target.value)}
          />
          {errors.content ? (
            <div className="field-error" id="post-content-error">
              {errors.content}
            </div>
          ) : null}
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
