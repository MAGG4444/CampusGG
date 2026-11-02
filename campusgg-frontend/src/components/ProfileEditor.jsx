import { useEffect, useRef } from 'react'
import { Gamepad2, Trash2, UserRound } from 'lucide-react'
import {
  experienceLevels,
  profileLimits,
  rolesForGame,
  suggestedGames,
} from '../utils/profile.js'

export function ProfileLeaveDialog({ blocker }) {
  const dialog = useRef(null)
  useEffect(() => {
    if (blocker.state === 'blocked' && !dialog.current.open) {
      dialog.current.showModal()
    } else if (blocker.state !== 'blocked' && dialog.current.open) {
      dialog.current.close()
    }
  }, [blocker.state])
  return (
    <dialog ref={dialog} className="profile-leave-dialog"
      aria-labelledby="profile-leave-title"
      onCancel={(event) => { event.preventDefault(); blocker.reset?.() }}>
      <h2 id="profile-leave-title">Leave without saving?</h2>
      <p>Your unsaved profile changes will be lost.</p>
      <div className="profile-edit-actions">
        <button type="button" className="profile-secondary-button"
          onClick={() => blocker.reset?.()}>Stay</button>
        <button type="button" className="profile-danger-button"
          onClick={() => blocker.proceed?.()}>Leave page</button>
      </div>
    </dialog>
  )
}

function FieldError({ field, message }) {
  return message ? (
    <p className="profile-error" id={`profile-${field}-error`} role="alert">
      {message}
    </p>
  ) : null
}

function SettingsNav({ activeSection, onChange }) {
  return (
    <nav className="profile-settings-nav" aria-label="Profile settings sections">
      <button type="button" aria-current={activeSection === 'basic' ? 'page' : undefined}
        onClick={() => onChange('basic')}>
        <UserRound size={18} aria-hidden="true" />
        <span>Basic Info</span>
      </button>
      <button type="button" aria-current={activeSection === 'gaming' ? 'page' : undefined}
        onClick={() => onChange('gaming')}>
        <Gamepad2 size={18} aria-hidden="true" />
        <span>Gaming Profile</span>
      </button>
    </nav>
  )
}

function BasicInfo({ editor, user, firstInput }) {
  const { values, errors, change } = editor
  return (
    <section className="profile-settings-panel" aria-labelledby="profile-basic-heading">
      <header className="profile-settings-heading">
        <p>Profile settings</p>
        <h2 id="profile-basic-heading">Basic Info</h2>
      </header>
      <div className="profile-form-grid">
        <label className="profile-edit-field" htmlFor="profile-displayName">
          Display Name
          <input ref={firstInput} id="profile-displayName"
            value={values.displayName} maxLength={profileLimits.displayName}
            required autoComplete="nickname"
            onChange={(event) => change('displayName', event.target.value)}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? 'profile-displayName-error' : undefined} />
          <FieldError field="displayName" message={errors.displayName} />
        </label>
        <label className="profile-edit-field profile-readonly-field" htmlFor="profile-username">
          Username <span>Cannot be changed</span>
          <input id="profile-username" value={user.username} readOnly aria-readonly="true" />
        </label>
        <label className="profile-edit-field profile-readonly-field profile-span-full"
          htmlFor="profile-email">
          Email <span>Verified account email</span>
          <input id="profile-email" value={user.email} readOnly aria-readonly="true" />
        </label>
        <label className="profile-edit-field profile-span-full" htmlFor="profile-bio">
          <span className="profile-field-label">Bio
            <span>{values.bio.length}/{profileLimits.bio}</span>
          </span>
          <textarea id="profile-bio" value={values.bio}
            maxLength={profileLimits.bio} rows={5}
            placeholder="Share what you play and what kind of teammates you enjoy."
            onChange={(event) => change('bio', event.target.value)}
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={errors.bio ? 'profile-bio-error' : undefined} />
          <FieldError field="bio" message={errors.bio} />
        </label>
      </div>
    </section>
  )
}

function GamingProfile({ editor }) {
  const { values, errors } = editor
  return (
    <section className="profile-settings-panel" aria-labelledby="profile-gaming-heading">
      <header className="profile-settings-heading">
        <p>Profile settings</p>
        <h2 id="profile-gaming-heading">Gaming Profile</h2>
      </header>

      <label className="profile-edit-field" htmlFor="profile-game">
        Add a game <span>Up to {profileLimits.games}</span>
      </label>
      <div className="profile-game-add">
        <input id="profile-game" value={editor.gameInput} list="profile-game-suggestions"
          maxLength={profileLimits.gameName} placeholder="Search or enter a game"
          onChange={(event) => editor.setGameInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              editor.addGame()
            }
          }}
          aria-invalid={Boolean(editor.gameError || errors.gamingProfiles)}
          aria-describedby={editor.gameError || errors.gamingProfiles
            ? 'profile-gamingProfiles-error' : undefined} />
        <datalist id="profile-game-suggestions">
          {suggestedGames.map((game) => <option key={game} value={game} />)}
        </datalist>
        <button className="profile-secondary-button" type="button"
          onClick={editor.addGame}>Add Game</button>
      </div>
      <FieldError field="gamingProfiles"
        message={editor.gameError || errors.gamingProfiles} />

      <div className="profile-game-edit-list">
        {values.gamingProfiles.map((profile, index) => (
          <section className="profile-game-editor" key={profile.game}
            aria-labelledby={`profile-game-${index}`}>
            <div className="profile-game-editor-heading">
              <h3 id={`profile-game-${index}`}>{profile.game}</h3>
              <button type="button" onClick={() => editor.removeGame(profile.game)}
                aria-label={`Remove ${profile.game}`}>
                <Trash2 size={17} aria-hidden="true" /> Remove
              </button>
            </div>

            <div className="profile-game-fields">
              <div>
                <p className="profile-control-label">Preferred Roles
                  <span>Optional · choose any</span>
                </p>
                <div className="profile-role-options" role="group"
                  aria-label={`Preferred roles for ${profile.game}`}>
                  {rolesForGame(profile.game).map((role) => (
                    <button key={role} type="button"
                      aria-pressed={profile.preferredRoles.includes(role)}
                      onClick={() => editor.toggleRole(profile.game, role)}>{role}</button>
                  ))}
                </div>
              </div>
              <label className="profile-edit-field"
                htmlFor={`profile-experience-${index}`}>
                Experience Level
                <select id={`profile-experience-${index}`}
                  value={profile.experienceLevel}
                  onChange={(event) => editor.changeExperience(
                    profile.game,
                    event.target.value,
                  )}>
                  {experienceLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ))}
      </div>
      {!values.gamingProfiles.length && (
        <div className="profile-empty-note">
          <Gamepad2 size={20} aria-hidden="true" />
          <span>Add a game to set roles and experience.</span>
        </div>
      )}
    </section>
  )
}

export default function ProfileEditor({ editor, user }) {
  const firstInput = useRef(null)
  useEffect(() => {
    if (editor.activeSection === 'basic') firstInput.current?.focus()
  }, [editor.activeSection])

  return (
    <form className="profile-edit-form" noValidate onSubmit={editor.save}
      aria-label="Edit Profile" aria-busy={editor.isSaving}>
      <fieldset className="profile-edit-fields" disabled={editor.isSaving}>
        <legend className="sr-only">Edit your profile</legend>
        <SettingsNav activeSection={editor.activeSection}
          onChange={editor.setActiveSection} />
        <div className="profile-settings-content">
          {editor.activeSection === 'basic'
            ? <BasicInfo editor={editor} user={user} firstInput={firstInput} />
            : <GamingProfile editor={editor} />}
          <div className="profile-edit-actions">
            <button className="profile-save-button" type="submit"
              disabled={editor.isSaving}>
              {editor.isSaving ? 'Saving…' : 'Save Changes'}
            </button>
            <button className="profile-secondary-button" type="button"
              disabled={editor.isSaving} onClick={editor.discard}>Cancel</button>
          </div>
        </div>
      </fieldset>
    </form>
  )
}
