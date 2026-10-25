import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, FilePenLine } from 'lucide-react'
import VersionLabel from '../components/VersionLabel.jsx'
import { useAuth } from '../context/useAuth.js'
import ProfileEditor, { ProfileLeaveDialog } from '../components/ProfileEditor.jsx'
import { useProfileEditor } from '../hooks/useProfileEditor.js'
import './Profile.css'

function ProfileContent({ user }) {
  const { signOut, updateProfile, canUpdateProfile } = useAuth()
  const editor = useProfileEditor(user, updateProfile, canUpdateProfile)
  const navigate = useNavigate()

  const profileName = user.displayName || user.username
  const avatarInitial = profileName.charAt(0).toUpperCase()

  function handleSignOut() {
    if (!editor.discard()) return
    // Leave the protected page before clearing auth so its redirect cannot win the navigation.
    navigate('/', { replace: true, flushSync: true })
    signOut()
  }

  return (
    <div className="profile-page page-enter">
      <ProfileLeaveDialog blocker={editor.blocker} />
      <section className="profile-card" aria-labelledby="profile-title">
        <header className="profile-header">
          <div
            className="profile-avatar"
            role="img"
            aria-label={`${profileName}'s profile avatar`}
          >
            {avatarInitial}
          </div>
          <div>
            <p className="profile-eyebrow">Player Profile</p>
            <h1 id="profile-title">{profileName}</h1>
            <p className="profile-username">@{user.username}</p>
          </div>
          {!editor.editing && <button className="profile-edit-button profile-edit-trigger" type="button" onClick={editor.begin}>Edit Profile</button>}
        </header>
        <div aria-live="polite" aria-atomic="true">
          {editor.feedback && <p role={editor.feedback.type === 'error' ? 'alert' : 'status'}
            className={editor.feedback.type === 'error' ? 'profile-error' : 'profile-success'}>{editor.feedback.message}</p>}
        </div>

        <div className="profile-grid">
          {editor.editing ? <ProfileEditor user={user} editor={editor} /> : <>
          <section className="profile-section" aria-labelledby="contact-heading">
            <h2 id="contact-heading">Account</h2>
            <dl className="profile-details">
              <div>
                <dt>Username</dt>
                <dd>{user.username}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              {user.displayName ? (
                <div>
                  <dt>Display Name</dt>
                  <dd>{user.displayName}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="profile-section" aria-labelledby="gaming-heading">
            <h2 id="gaming-heading">Gaming</h2>
            <div className="profile-field">
              <h3>Favorite Games</h3>
              {user.favoriteGames?.length ? (
                <ul className="profile-game-list">
                  {user.favoriteGames.map((game) => <li key={game}>{game}</li>)}
                </ul>
              ) : (
                <p>Not provided</p>
              )}
            </div>
            <div className="profile-field">
              <h3>Skill Level</h3>
              <p>{user.skillLevel || 'Not provided'}</p>
            </div>
          </section>

          <section className="profile-section profile-about" aria-labelledby="about-heading">
            <h2 id="about-heading">About Me</h2>
            <p>{user.bio || 'No bio added yet.'}</p>
          </section>
          </>}
          <Link className="profile-section profile-drafts" to="/drafts" aria-labelledby="profile-drafts-title">
            <FilePenLine size={28} aria-hidden="true" />
            <div>
              <h2 id="profile-drafts-title">My Drafts</h2>
              <p>Continue your saved lobbies and forum posts.</p>
            </div>
            <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </div>

        <div className="profile-actions">
          <VersionLabel />
          <button className="profile-signout" type="button" onClick={handleSignOut} disabled={editor.isSaving}>
            Sign Out
          </button>
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
