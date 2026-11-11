import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import './SignIn.css'

const PENDING_EMAIL_KEY = 'campusgg-pending-email'

function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { verifyEmail, resendVerification } = useAuth()

  // Route state handles first signup; session storage handles returning later.
  const [email, setEmail] = useState(
    () => location.state?.email || sessionStorage.getItem(PENDING_EMAIL_KEY) || '',
  )
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.edu$/.test(normalizedEmail)) {
      sessionStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail)
    }
  }, [email])

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
      sessionStorage.removeItem(PENDING_EMAIL_KEY)
      navigate('/signin', {
        replace: true,
        state: { verified: true, email: email.trim().toLowerCase() },
      })
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
    const normalizedEmail = email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.edu$/.test(normalizedEmail)) {
      setError('Enter a valid .edu email address to request a new code.')
      return
    }

    setError('')
    setIsResending(true)

    try {
      const response = await resendVerification(normalizedEmail)
      sessionStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail)
      setCode('')
      setSuccessMessage(
        response?.message || 'If this account is pending verification, check your inbox for a new code.',
      )
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to request a new verification code. Please try again.',
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
          Enter your 6-digit code to finish creating your account. If you left
          this page earlier or the code expired, request a new one below.
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
                setCode('')
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
              inputMode="numeric"
              maxLength={6}
              value={code}
              placeholder="000000"
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
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

          <button className="signin-submit" type="submit" disabled={isSubmitting || isResending}>
            {isSubmitting ? 'Verifying...' : 'Verify Email'}
          </button>

          <p className="auth-switch" style={{ marginTop: 16 }}>
            Didn&apos;t receive a code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || isSubmitting}
              aria-busy={isResending}
              className="resend-link"
            >
              {isResending ? 'Resending...' : 'Resend code'}
            </button>
          </p>

          <p className="auth-switch">
            Already verified? <Link to="/signin">Sign In</Link>
          </p>
        </form>
      </section>
    </div>
  )
}

export default VerifyEmail
