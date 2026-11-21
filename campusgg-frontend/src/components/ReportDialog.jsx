import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmationModal.css'

export default function ReportDialog({ target, onCancel, onSubmit }) {
  const dialog = useRef(null)
  const reasonRef = useRef(null)
  const titleId = useId()
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    reasonRef.current?.focus()
    return () => { if (element.open) element.close(); if (target.focus?.isConnected) target.focus.focus({ preventScroll: true }) }
  }, [target])
  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    if (!reason || (reason === 'other' && !customReason.trim())) { setError('Choose a reason and explain Other when selected.'); return }
    submitting.current = true; setBusy(true); setError('')
    try { await onSubmit({ reason, ...(reason === 'other' ? { customReason: customReason.trim() } : {}), details: details.trim() }); onCancel() }
    catch (err) { setError(err.message || 'Unable to submit report.') }
    finally { submitting.current = false; setBusy(false) }
  }
  return createPortal(<dialog ref={dialog} className="confirmation-modal report-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id={titleId}>Report {target.commentId ? 'Reply' : 'Post'}</h2>
    <form onSubmit={submit} noValidate>
      <label>Reason <select ref={reasonRef} required value={reason} onChange={event => setReason(event.target.value)}><option value="">Select a reason</option><option value="spam">Spam or advertising</option><option value="harassment">Harassment or bullying</option><option value="hate">Hate or abusive content</option><option value="inappropriate">Inappropriate content</option><option value="other">Other</option></select></label>
      {reason === 'other' && <label>Other reason <textarea required maxLength={1000} value={customReason} onChange={event => setCustomReason(event.target.value)} /></label>}
      <label>Additional details (optional) <textarea maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} /></label>
      {error && <p className="confirmation-modal-error" role="alert">{error}</p>}
      <div className="confirmation-modal-actions"><button className="confirmation-modal-cancel" type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="confirmation-modal-confirm" type="submit" disabled={busy}>{busy ? 'Submitting...' : 'Submit Report'}</button></div>
    </form>
  </dialog>, document.body)
}
