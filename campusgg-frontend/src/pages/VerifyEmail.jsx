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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  async function handleVerify(event) {
    event.preventDefault()

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

    if (!email.trim()) {
      setError('Enter your email address to resend the code.')
      return
    }

    setError('')
    setIsResending(true)

    try {
      await resendVerification(email)
      setError('')
      // Use a temporary success-style message via error color won't work;
      // instead show a brief confirmation by setting error to empty and
      // relying on the button state change.
    } catch (err) {
      setError(
        err instanceof Error
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
