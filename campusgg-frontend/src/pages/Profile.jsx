import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import './Profile.css'

function Profile() {
  const { user, isAuthenticated, signOut } = useAuth()
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />
  }

  const profileName = user.displayName || user.username
  const avatarInitial = profileName.charAt(0).toUpperCase()

  function handleSignOut() {
    signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="profile-page">
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
        </header>

        <div className="profile-grid">
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
        </div>

        <div className="profile-actions">
          <button className="profile-signout" type="button" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>
    </div>
  )
}

export default Profile
