import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, FolderOpen, PencilLine } from 'lucide-react'
import VersionLabel from '../components/VersionLabel.jsx'
import { useAuth } from '../context/useAuth.js'
import ProfileEditor, { ProfileLeaveDialog } from '../components/ProfileEditor.jsx'
import { useProfileEditor } from '../hooks/useProfileEditor.js'
import './Profile.css'

function ProfileContent({ user }) {
  const { signOut, updateProfile } = useAuth()
  const editor = useProfileEditor(user, updateProfile)
  const navigate = useNavigate()
  const profileName = user.displayName || user.username
  const avatarInitial = profileName.charAt(0).toUpperCase()

  function handleSignOut() {
    if (!editor.discard()) return
    navigate('/', { replace: true, flushSync: true })
    signOut()
  }

  return (
    <div className="profile-page page-enter">
      <ProfileLeaveDialog blocker={editor.blocker} />
      <section className="profile-card" aria-labelledby="profile-title">
        <header className="profile-header">
          <div className="profile-avatar" role="img"
            aria-label={`${profileName}'s profile avatar`}>
            {avatarInitial}
          </div>
          <div className="profile-identity">
            <p className="profile-eyebrow">Player Profile</p>
            <h1 id="profile-title">{profileName}</h1>
            <p className="profile-username">@{user.username}</p>
          </div>
          {!editor.editing && (
            <button className="profile-edit-button profile-edit-trigger"
              type="button" onClick={editor.begin}>
              <PencilLine size={18} aria-hidden="true" /> Edit Profile
            </button>
          )}
        </header>

        <div aria-live="polite" aria-atomic="true">
          {editor.feedback && (
            <p role={editor.feedback.type === 'error' ? 'alert' : 'status'}
              className={editor.feedback.type === 'error'
                ? 'profile-error profile-feedback'
                : 'profile-success profile-feedback'}>
              {editor.feedback.message}
            </p>
          )}
        </div>

        <div className="profile-grid">
          {editor.editing ? <ProfileEditor editor={editor} user={user} /> : (
            <>
              <section className="profile-section" aria-labelledby="contact-heading">
                <h2 id="contact-heading">Account</h2>
                <dl className="profile-details">
                  <div><dt>Username</dt><dd>{user.username}</dd></div>
                  <div><dt>Email</dt><dd>{user.email}</dd></div>
                  {user.displayName ? (
                    <div><dt>Display Name</dt><dd>{user.displayName}</dd></div>
                  ) : null}
                </dl>
              </section>

              <section className="profile-section" aria-labelledby="gaming-heading">
                <h2 id="gaming-heading">Gaming Profile</h2>
                <div className="profile-field">
                  {user.gamingProfiles?.length ? (
                    <ul className="profile-game-profiles">
                      {user.gamingProfiles.map((profile) => (
                        <li key={profile.game}>
                          <div className="profile-game-summary">
                            <strong>{profile.game}</strong>
                            <span>{profile.experienceLevel}</span>
                          </div>
                          <div className="profile-role-chips"
                            aria-label={`Preferred roles for ${profile.game}`}>
                            {profile.preferredRoles.length
                              ? profile.preferredRoles.map((role) => (
                                <span key={role}>{role}</span>
                              ))
                              : <em>No preferred roles</em>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p>Not provided</p>}
                </div>
              </section>

              <section className="profile-section profile-about"
                aria-labelledby="about-heading">
                <h2 id="about-heading">About Me</h2>
                <p>{user.bio || 'No bio added yet.'}</p>
              </section>
            </>
          )}

          <Link className="profile-section profile-content" to="/my-content"
            aria-labelledby="profile-content-title">
            <FolderOpen size={28} aria-hidden="true" />
            <div>
              <h2 id="profile-content-title">My Content</h2>
              <p>Manage your posts, lobbies, and drafts.</p>
            </div>
            <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </div>

        <div className="profile-actions">
          <VersionLabel />
          <button className="profile-signout" type="button"
            onClick={handleSignOut} disabled={editor.isSaving}>Sign Out</button>
        </div>
      </section>
    </div>
  )
}

export default function Profile() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/signin" replace />
  return <ProfileContent key={user.id} user={user} />
}
