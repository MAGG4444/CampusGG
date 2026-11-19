import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import './ConfirmationModal.css'

export default function ConfirmationModal({ title, message, confirmLabel, destructive, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement
    dialog.showModal()
    cancelRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])

  function handleKeyDown(event) {
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled)')]
    if (!controls.length) { event.preventDefault(); return }
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault()
      controls[controls.length - 1].focus()
    } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
      event.preventDefault()
      controls[0].focus()
    }
  }

  return createPortal(
    <dialog ref={dialogRef} className="confirmation-modal" role="alertdialog" aria-modal="true"
      aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={handleKeyDown}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
      <span className={`confirmation-modal-icon ${destructive ? 'confirmation-modal-icon-danger' : ''}`}><AlertTriangle size={22} aria-hidden="true" /></span>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{message}</p>
      {error && <p className="confirmation-modal-error" role="alert">{error}</p>}
      <div className="confirmation-modal-actions">
        <button ref={cancelRef} type="button" className="confirmation-modal-cancel" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className={`confirmation-modal-confirm ${destructive ? 'confirmation-modal-danger' : ''}`}
          disabled={busy} onClick={onConfirm}>{busy ? 'Processing...' : confirmLabel}</button>
      </div>
    </dialog>, document.body,
  )
}
