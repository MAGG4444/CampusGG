import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import './SignIn.css'

const PENDING_EMAIL_KEY = 'campusgg-pending-email'

function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password to sign in.')
      return
    }

    const emailInput = event.currentTarget.elements.namedItem('email')

    if (!emailInput.validity.valid) {
      setError('Enter a valid email address.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await signIn(email, password)
      setPassword('')
      sessionStorage.removeItem(PENDING_EMAIL_KEY)

      // Return to where the user was trying to go (e.g., /matchmaking).
      navigate(location.state?.from?.pathname || '/')
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Unable to sign in. Please try again.'

      // The backend returns this only after validating the user's password.
      // Redirect the unverified user to the existing verification flow.
      if (message.toLowerCase().includes('verify your .edu email')) {
        const normalizedEmail = email.trim().toLowerCase()
        sessionStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail)
        navigate('/verify-email', { state: { email: normalizedEmail } })
        return
      }

      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="signin-page page-enter">
      <section className="signin-card" aria-labelledby="signin-title">
        <p className="signin-brand">
          Campus<span>GG</span>
        </p>

        <h1 id="signin-title">Sign In</h1>

        <p className="signin-intro">
          Welcome back. Your next squad is waiting.
        </p>

        {location.state?.verified && (
          <p className="signin-intro" role="status">
            Your email is verified. You can now sign in.
          </p>
        )}

        <form noValidate onSubmit={handleSubmit}>
          <div className="signin-field">
            <label htmlFor="signin-email">Email</label>

            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              aria-describedby={error ? 'signin-error' : undefined}
              aria-invalid={Boolean(error) && !email.trim() ? 'true' : undefined}
              onChange={(event) => {
                setEmail(event.target.value)
                setError('')
              }}
            />
          </div>

          <div className="signin-field">
            <label htmlFor="signin-password">Password</label>

            <input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-describedby={error ? 'signin-error' : undefined}
              aria-invalid={Boolean(error) && !password.trim() ? 'true' : undefined}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
            />
          </div>

          {error ? (
            <p className="signin-error" id="signin-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="signin-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          Haven&apos;t verified your account?{' '}
          <Link to="/verify-email" state={{ email: email.trim().toLowerCase() }}>
            Verify Email
          </Link>
        </p>
        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </section>
    </div>
  )
}

export default SignIn
