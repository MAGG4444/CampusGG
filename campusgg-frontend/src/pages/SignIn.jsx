import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import './SignIn.css'

function SignIn() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
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
    signIn(email)
    setPassword('')
    navigate('/')
  }

  return (
    <div className="signin-page">
      <section className="signin-card" aria-labelledby="signin-title">
        <p className="signin-brand">Campus<span>GG</span></p>
        <h1 id="signin-title">Sign In</h1>
        <form noValidate onSubmit={handleSubmit}>
          <div className="signin-field">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
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
              aria-invalid={Boolean(error) && !password.trim() ? 'true' : undefined}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
            />
          </div>
          {error ? <p className="signin-error" role="alert">{error}</p> : null}
          <button className="signin-submit" type="submit">Sign In</button>
        </form>
      </section>
    </div>
  )
}

export default SignIn
