import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import './SignIn.css'

function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { verifyEmail, resendVerification } = useAuth()

  // Pre-fill email from route state if we arrived from the signup page.
  const initialEmail = location.state?.email ?? ''
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  async function handleVerify(event) {
    event.preventDefault()
    setSuccessMessage('')

    if (!email.trim() || !code.trim()) {
      setError('Enter your email and the 6-digit verification code.')
      return
    }

    if (!/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await verifyEmail(email, code)

      // Verification complete — send them to sign in.
      navigate('/signin')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify email. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend(event) {
    event.preventDefault()

    if (isResending) return

    setSuccessMessage('')
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Enter your email address to resend the code.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    if (!trimmedEmail.toLowerCase().endsWith('.edu')) {
      setError('Use an email address that ends in .edu.')
      return
    }

    setError('')
    setIsResending(true)

    try {
      await resendVerification(trimmedEmail)
      setError('')
      setSuccessMessage(`Verification code resent to ${trimmedEmail}. Check your inbox.`)
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to resend verification code. Please try again.',
      )
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="signin-page page-enter">
      <section className="signin-card" aria-labelledby="verify-title">
        <p className="signin-brand">
          Campus<span>GG</span>
        </p>

        <h1 id="verify-title">Verify Your Email</h1>
        <p className="signin-intro">
          A 6-digit code was sent to your inbox. Enter it below to complete
          registration.
        </p>

        <form className="verify-form" noValidate onSubmit={handleVerify}>
          <div className="signin-field">
            <label htmlFor="verify-email">.edu Email</label>
            <input
              id="verify-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@university.edu"
              onChange={(event) => {
                setEmail(event.target.value)
                setError('')
                setSuccessMessage('')
              }}
              required
            />
          </div>

          <div className="signin-field">
            <label htmlFor="verify-code">Verification Code</label>
            <input
              id="verify-code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              inputmode="numeric"
              maxlength="6"
              value={code}
              placeholder="000000"
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ''))
                setError('')
              }}
              required
            />
          </div>

          {error ? (
            <p className="signin-error" id="verify-error" role="alert">
              {error}
            </p>
          ) : null}

          <div role="status" aria-live="polite" aria-atomic="true">
            {successMessage ? (
              <p className="signin-intro">{successMessage}</p>
            ) : null}
          </div>

          <button
            className="signin-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Verifying...' : 'Verify Email'}
          </button>

          <p className="auth-switch" style={{ marginTop: 16 }}>
            Didn&apos;t receive a code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              aria-busy={isResending}
              className="resend-link"
            >
              {isResending ? 'Resending...' : 'Resend code'}
            </button>
          </p>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/signin">Sign In</Link>
          </p>
        </form>
      </section>
    </div>
  )
}

export default VerifyEmail
