import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useNotifications } from '../components/notifications/useNotifications.js'
import { deleteDraft, draftDefaults, getDraft, saveDraft } from '../utils/draftStorage.js'
import { createDraftNavigationGuard } from '../utils/draftNavigation.js'

function loadEditor(userId, type, id) {
  let formData = draftDefaults[type]
  let statusMessage = ''
  let blocked = false
  if (id !== null) {
    try {
      formData = getDraft(userId, id, type).formData
      statusMessage = 'Draft restored. Continue editing below.'
    } catch {
      blocked = true
      statusMessage = 'Unable to restore this draft. Open My Drafts or start a new draft.'
    }
  }
  return { userId, type, id, requestedId: id, formData, savedData: JSON.stringify(formData), statusMessage, blocked }
}

export function useDraftEditor(type, isPublishing) {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const userId = user?.id
  const { state: navigationState } = useLocation()
  const [params, setParams] = useSearchParams()
  const requestedId = params.get('draftId')
  const [editor, setEditor] = useState(() => loadEditor(userId, type, requestedId))
  const published = useRef(false)
  const [navigationGuard] = useState(createDraftNavigationGuard)

  // Reset synchronously on account/URL changes, before a stale form can be saved.
  if (editor.userId !== userId || editor.type !== type) {
    setEditor(loadEditor(userId, type, requestedId))
  } else if (editor.requestedId !== requestedId) {
    // Router navigation can commit after the local save/delete state update.
    setEditor(editor.id === requestedId
      ? { ...editor, requestedId }
      : loadEditor(userId, type, requestedId))
  }

  const { id, formData, savedData, statusMessage, blocked } = editor
  const dirty = JSON.stringify(formData) !== savedData
  const navigationBlocker = useBlocker(useCallback((navigation) => (
    navigationGuard.shouldBlock(dirty, published.current, navigation)
  ), [dirty, navigationGuard]))
  const setStatusMessage = useCallback((message) => {
    setEditor((current) => ({ ...current, statusMessage: message }))
  }, [])
  const setFormData = useCallback((update) => {
    setEditor((current) => ({
      ...current,
      formData: typeof update === 'function' ? update(current.formData) : update,
    }))
  }, [])

  const persist = useCallback((automatic = false) => {
    if (blocked || published.current) return false
    try {
      const draft = saveDraft(userId, type, formData, id)
      setEditor((current) => ({
        ...current, id: draft.id, savedData: JSON.stringify(draft.formData),
        statusMessage: automatic ? 'Draft automatically saved locally in this browser.' : 'Draft saved locally in this browser.',
      }))
      if (id === null) {
        navigationGuard.replaceDraftUrl(() => setParams((current) => {
          current.set('draftId', draft.id)
          return current
        }, { replace: true, state: navigationState }))
      }
      return true
    } catch {
      setStatusMessage(userId
        ? 'Unable to save draft. Your changes are still in this form; please try again.'
        : 'Please sign in to save drafts.')
      return false
    }
  }, [blocked, userId, type, formData, id, setParams, setStatusMessage, navigationGuard, navigationState])

  useEffect(() => {
    if (!id || !dirty || isPublishing || blocked || navigationBlocker.state !== 'unblocked') return
    const timer = window.setTimeout(() => persist(true), 800)
    return () => window.clearTimeout(timer)
  }, [id, dirty, isPublishing, blocked, persist, navigationBlocker.state])

  useEffect(() => {
    if (!dirty) return
    function beforeUnload(event) {
      if (published.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [dirty])

  function discard() {
    if (!window.confirm('Delete this draft and clear this form? This cannot be undone.')) return false
    try {
      if (id !== null) deleteDraft(userId, id)
      setEditor({ ...loadEditor(userId, type, null), requestedId,
        statusMessage: 'Draft deleted. The form is now empty.' })
      navigationGuard.replaceDraftUrl(() => setParams((current) => {
        current.delete('draftId')
        return current
      }, { replace: true, state: navigationState }))
      return true
    } catch {
      setStatusMessage('Unable to delete draft. Your draft and form have been kept.')
      return false
    }
  }

  // Cleanup failure must never turn a successful backend publish into a retryable publish error.
  function completePublish() {
    published.current = true
    try {
      if (id !== null) deleteDraft(userId, id)
    } catch {
      addNotification({ type: 'warning', title: 'Published; draft cleanup failed', message: 'Published successfully, but the local draft could not be removed. Delete it from My Drafts; do not publish it again.' })
    }
  }

  return { formData, setFormData, statusMessage, setStatusMessage, blocked,
    save: () => persist(), discard, completePublish, navigationBlocker }
}
