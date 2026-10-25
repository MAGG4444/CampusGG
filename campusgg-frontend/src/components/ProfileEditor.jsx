import { useEffect, useRef } from 'react'
import { profileLimits, skillLevels } from '../utils/profile.js'

export function ProfileLeaveDialog({ blocker }) {
  const dialog = useRef(null)
  useEffect(() => {
    if (blocker.state === 'blocked') dialog.current.showModal()
    else dialog.current.close()
  }, [blocker.state])
  return (
    <dialog ref={dialog} className="profile-leave-dialog" aria-labelledby="profile-leave-title"
      onCancel={(event) => { event.preventDefault(); blocker.reset?.() }}>
      <h2 id="profile-leave-title">Leave without saving?</h2>
      <p>Your unsaved profile changes will be lost.</p>
      <div className="profile-edit-actions">
        <button type="button" className="profile-edit-button" onClick={() => blocker.reset?.()}>Stay</button>
        <button type="button" className="profile-signout" onClick={() => blocker.proceed?.()}>Leave page</button>
      </div>
    </dialog>
  )
}

function FieldError({ field, message }) {
  return message ? <p className="profile-error" id={`profile-${field}-error`} role="alert">{message}</p> : null
}

export default function ProfileEditor({ user, editor }) {
  const firstInput = useRef(null)
  useEffect(() => { firstInput.current.focus() }, [])
  const { values, errors, change, isSaving } = editor
  return (
    <form className="profile-edit-form" noValidate onSubmit={editor.save} aria-label="Edit Profile" aria-busy={isSaving}>
      <fieldset className="profile-edit-fields" disabled={isSaving}>
        <legend className="profile-edit-legend">Edit your profile</legend>
        <section className="profile-section" aria-labelledby="contact-heading">
          <h2 id="contact-heading">Account</h2>
          <dl className="profile-details">
            <div><dt>Username (read-only)</dt><dd>{user.username}</dd></div>
            <div><dt>Email (read-only)</dt><dd>{user.email}</dd></div>
          </dl>
          <label className="profile-edit-field" htmlFor="profile-displayName">Display Name
            <input ref={firstInput} id="profile-displayName" value={values.displayName} maxLength={profileLimits.displayName}
              required autoComplete="nickname" onChange={(event) => change('displayName', event.target.value)}
              aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? 'profile-displayName-error' : undefined} />
          </label>
          <FieldError field="displayName" message={errors.displayName} />
        </section>
        <section className="profile-section" aria-labelledby="gaming-heading">
          <h2 id="gaming-heading">Gaming</h2>
          <label className="profile-edit-field" htmlFor="profile-game">Favorite Games (up to 10)</label>
          <div className="profile-game-add">
            <input id="profile-game" value={editor.gameInput} maxLength={profileLimits.gameName}
              onChange={(event) => editor.setGameInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); editor.addGame() } }}
              aria-invalid={Boolean(editor.gameError || errors.favoriteGames)}
              aria-describedby={editor.gameError || errors.favoriteGames ? 'profile-favoriteGames-error' : undefined} />
            <button className="profile-edit-button" type="button" onClick={editor.addGame}>Add</button>
          </div>
          <FieldError field="favoriteGames" message={editor.gameError || errors.favoriteGames} />
          <ul className="profile-game-list profile-edit-games">
            {values.favoriteGames.map((game, index) => <li key={`${game}-${index}`}>
              {game}<button type="button" aria-label={`Remove ${game}`} onClick={() => change('favoriteGames', values.favoriteGames.filter((_, i) => i !== index))}>×</button>
            </li>)}
          </ul>
          <label className="profile-edit-field" htmlFor="profile-skillLevel">Skill Level
            <select id="profile-skillLevel" value={values.skillLevel} onChange={(event) => change('skillLevel', event.target.value)}
              aria-invalid={Boolean(errors.skillLevel)} aria-describedby={errors.skillLevel ? 'profile-skillLevel-error' : undefined}>
              {skillLevels.map((level) => <option key={level} value={level}>{level || 'Not provided'}</option>)}
            </select>
          </label>
          <FieldError field="skillLevel" message={errors.skillLevel} />
        </section>
        <section className="profile-section profile-about" aria-labelledby="about-heading">
          <h2 id="about-heading">About Me</h2>
          <label className="profile-edit-field" htmlFor="profile-bio">Bio (up to 500 characters)
            <textarea id="profile-bio" value={values.bio} maxLength={profileLimits.bio} rows={5}
              onChange={(event) => change('bio', event.target.value)} aria-invalid={Boolean(errors.bio)}
              aria-describedby={errors.bio ? 'profile-bio-error' : undefined} />
          </label>
          <FieldError field="bio" message={errors.bio} />
        </section>
      </fieldset>
      {!editor.canUpdateProfile && <p id="profile-save-unavailable" className="profile-save-note">Saving profile changes is not available yet; backend support is required. Your edits will not be saved.</p>}
      <div className="profile-edit-actions">
        <button className="profile-edit-button profile-save-button" type="submit" disabled={!editor.canUpdateProfile || isSaving}
          aria-describedby={!editor.canUpdateProfile ? 'profile-save-unavailable' : undefined}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
        <button className="profile-edit-button" type="button" disabled={isSaving} onClick={editor.discard}>Cancel</button>
      </div>
    </form>
  )
}
