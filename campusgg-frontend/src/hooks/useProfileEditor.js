import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { profileValues, validateProfile } from '../utils/profile.js'

export function useProfileEditor(user, updateProfile, canUpdateProfile) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState(() => profileValues(user))
  const [gameInput, setGameInput] = useState('')
  const [gameError, setGameError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const saving = useRef(false)
  const allowLeave = useRef(false)
  const dirty = editing && (JSON.stringify(values) !== JSON.stringify(profileValues(user)) || gameInput !== '')
  const errors = validateProfile(values)
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => (
    dirty && !allowLeave.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
  ), [dirty]))

  useEffect(() => {
    if (!dirty) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function begin() {
    allowLeave.current = false
    setValues(profileValues(user))
    setGameInput('')
    setGameError('')
    setFeedback(null)
    setEditing(true)
  }

  function discard() {
    if (saving.current || (dirty && !window.confirm('Discard your unsaved profile changes?'))) return false
    allowLeave.current = true
    setEditing(false)
    setValues(profileValues(user))
    setGameInput('')
    setGameError('')
    setFeedback(null)
    return true
  }

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setFeedback(null)
  }

  function addGame() {
    const game = gameInput.trim()
    if (!game) { setGameError('Enter a game name.'); return }
    const next = [...values.favoriteGames, game]
    const error = validateProfile({ ...values, favoriteGames: next }).favoriteGames
    if (error) { setGameError(error); return }
    change('favoriteGames', next)
    setGameInput('')
    setGameError('')
  }

  async function save(event) {
    event.preventDefault()
    if (saving.current) return
    if (Object.keys(errors).length || gameInput.trim()) {
      if (gameInput.trim()) setGameError('Add this game or clear the game name before saving.')
      setFeedback({ type: 'error', message: 'Correct the highlighted fields before saving.' })
      return
    }
    if (!canUpdateProfile) {
      setFeedback({ type: 'error', message: 'Profile saving requires backend support and is not available yet.' })
      return
    }
    saving.current = true
    setIsSaving(true)
    setFeedback(null)
    try {
      await updateProfile(values)
      allowLeave.current = true
      setEditing(false)
      setFeedback({ type: 'success', message: 'Profile updated successfully.' })
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save profile. Please try again.' })
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  return { editing, values, errors, gameInput, setGameInput, gameError, isSaving, feedback,
    blocker, begin, discard, change, addGame, save, canUpdateProfile }
}
