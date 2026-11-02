import { useEffect, useRef } from 'react'
import '../pages/CreateLobby.css'

export default function DraftNavigationDialog({ blocker }) {
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
      <h2 id="draft-navigation-title">Leave this draft?</h2>
      <p id="draft-navigation-description">Your latest changes may not be saved. Stay to continue editing or leave this page.</p>
      <div className="create-actions">
        <button type="button" className="footer-action footer-save" onClick={() => blocker.reset?.()}>Stay</button>
        <button type="button" className="footer-action footer-delete" onClick={() => blocker.proceed?.()}>Leave page</button>
      </div>
    </dialog>
  )
}
