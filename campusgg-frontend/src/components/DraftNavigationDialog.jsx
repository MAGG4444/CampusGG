import { useEffect, useRef } from 'react'
import '../pages/CreateLobby.css'

export default function DraftNavigationDialog({ blocker, title = 'Leave this draft?', description = 'Your latest changes may not be saved. Stay to continue editing or leave this page.', stayLabel = 'Stay', leaveLabel = 'Leave page' }) {
  const dialog = useRef(null)
  useEffect(() => {
    if (blocker.state === 'blocked') dialog.current.showModal()
    else dialog.current.close()
  }, [blocker.state])

  return (
    <dialog ref={dialog} className="draft-navigation-dialog" aria-labelledby="draft-navigation-title"
      aria-describedby="draft-navigation-description" onCancel={(event) => {
        event.preventDefault()
        blocker.reset?.()
      }}>
      <h2 id="draft-navigation-title">{title}</h2>
      <p id="draft-navigation-description">{description}</p>
      <div className="create-actions">
        <button type="button" className="footer-action footer-save" onClick={() => blocker.reset?.()}>{stayLabel}</button>
        <button type="button" className="footer-action footer-delete" onClick={() => blocker.proceed?.()}>{leaveLabel}</button>
      </div>
    </dialog>
  )
}
