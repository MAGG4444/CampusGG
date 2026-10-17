import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RegistrationApiError, registerUser } from '../services/authApi.js'
import './SignIn.css'
import './SignUp.css'

const initialValues = {
  email: '',
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
}

const fields = [
  {
    name: 'email',
    label: '.edu Email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'you@university.edu',
    className: 'signup-field-wide',
  },
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    autoComplete: 'username',
    placeholder: 'campusplayer',
    hint: '3–50 characters',
    minLength: 3,
    maxLength: 50,
  },
  {
    name: 'displayName',
    label: 'Display Name',
    type: 'text',
    autoComplete: 'name',
    placeholder: 'Campus Player',
    hint: 'Up to 100 characters',
    maxLength: 100,
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
    placeholder: 'Create a password',
    hint: '8–100 characters',
    minLength: 8,
    maxLength: 100,
  },
  {
    name: 'confirmPassword',
    label: 'Confirm Password',
    type: 'password',
    autoComplete: 'new-password',
    placeholder: 'Re-enter your password',
    minLength: 8,
    maxLength: 100,
  },
]

function validate(values) {
  const errors = {}
  const email = values.email.trim()
  const username = values.username.trim()
  const displayName = values.displayName.trim()

  if (!email) {
    errors.email = 'Enter your .edu email address.'
  } else if (!/^[^\s@]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  } else if (!email.toLowerCase().endsWith('.edu')) {
    errors.email = 'Use an email address that ends in .edu.'
  }

  if (!username) {
    errors.username = 'Enter a username.'
  } else if (username.length < 3) {
    errors.username = 'Username must be at least 3 characters.'
  } else if (username.length > 50) {
    errors.username = 'Username cannot exceed 50 characters.'
  }

  if (!displayName) {
    errors.displayName = 'Enter your display name.'
  } else if (displayName.length > 100) {
    errors.displayName = 'Display name cannot exceed 100 characters.'
  }

  if (!values.password) {
    errors.password = 'Enter a password.'
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  } else if (values.password.length > 100) {
    errors.password = 'Password cannot exceed 100 characters.'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

function mapBackendErrors(error) {
  if (!(error instanceof RegistrationApiError)) {
    return {
      fieldErrors: {},
      formError: 'CampusGG could not create your account right now. Please try again.',
    }
  }

  const fieldErrors = {}
  const formMessages = []

  error.messages.forEach((message) => {
    const normalizedMessage = message.toLowerCase()
    const mentionsEmail = normalizedMessage.includes('email')
    const mentionsUsername = normalizedMessage.includes('username')

    if (mentionsEmail && mentionsUsername) {
      formMessages.push(message)
    } else if (mentionsEmail) {
      fieldErrors.email = message
    } else if (mentionsUsername) {
      fieldErrors.username = message
    } else if (normalizedMessage.includes('display name')) {
      fieldErrors.displayName = message
    } else if (normalizedMessage.includes('password')) {
      fieldErrors.password = message
    } else {
      formMessages.push(message)
    }
  })

  return {
    fieldErrors,
    formError: formMessages.join(' ') || (Object.keys(fieldErrors).length ? '' : error.message),
  }
}

function SignUp() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const submissionInFlight = useRef(false)

  function handleChange(event) {
    const { name, value } = event.target

    setValues((currentValues) => ({ ...currentValues, [name]: value }))
    setErrors((currentErrors) => {
      if (!currentErrors[name]) return currentErrors

      const nextErrors = { ...currentErrors }
      delete nextErrors[name]
      return nextErrors
    })
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submissionInFlight.current) return

    const nextErrors = validate(values)
    setErrors(nextErrors)
    setFormError('')

    const firstInvalidField = fields.find((field) => nextErrors[field.name])
    if (firstInvalidField) {
      event.currentTarget.elements.namedItem(firstInvalidField.name)?.focus()
      return
    }

    const registrationData = {
      email: values.email.trim().toLowerCase(),
      username: values.username.trim(),
      displayName: values.displayName.trim(),
      password: values.password,
    }

    submissionInFlight.current = true
    setIsSubmitting(true)

    try {
      await registerUser(registrationData)
      setValues(initialValues)
      setErrors({})
      setRegisteredEmail(registrationData.email)
    } catch (error) {
      const backendErrors = mapBackendErrors(error)
      setErrors(backendErrors.fieldErrors)
      setFormError(backendErrors.formError)
    } finally {
      submissionInFlight.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="signin-page signup-page page-enter">
      <section className="signin-card signup-card" aria-labelledby="signup-title">
        <p className="signin-brand">
          Campus<span>GG</span>
        </p>
        <h1 id="signup-title">Create Account</h1>
        <p className="signin-intro">
          Join your campus gaming community and find your next squad.
        </p>

        {registeredEmail ? (
          <div className="signup-complete" role="status" aria-labelledby="signup-complete-title">
            <p className="signup-complete-kicker">Registration submitted</p>
            <h2 id="signup-complete-title">Check Your Email</h2>
            <p>
              Account created. Check <strong>{registeredEmail}</strong> to verify your CampusGG
              account before signing in.
            </p>
            <Link className="signin-submit signup-signin-link" to="/signin">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form className="signup-form" noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <div className="signup-form-grid">
            {fields.map((field) => {
              const errorId = `signup-${field.name}-error`
              const hintId = field.hint ? `signup-${field.name}-hint` : null
              const describedBy = [hintId, errors[field.name] ? errorId : null]
                .filter(Boolean)
                .join(' ') || undefined

              return (
                <div
                  className={`signin-field ${field.className ?? ''}`.trim()}
                  key={field.name}
                >
                  <label htmlFor={`signup-${field.name}`}>{field.label}</label>
                  <input
                    id={`signup-${field.name}`}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    autoCapitalize={field.name === 'email' || field.name === 'username' ? 'none' : undefined}
                    spellCheck={field.name === 'email' || field.name === 'username' ? 'false' : undefined}
                    placeholder={field.placeholder}
                    value={values[field.name]}
                    onChange={handleChange}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    aria-invalid={errors[field.name] ? 'true' : undefined}
                    aria-describedby={describedBy}
                    disabled={isSubmitting}
                    required
                  />
                  {field.hint && (
                    <span className="signup-field-hint" id={hintId}>
                      {field.hint}
                    </span>
                  )}
                  {errors[field.name] && (
                    <span className="signup-field-error" id={errorId}>
                      {errors[field.name]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {formError && (
            <p className="signin-error signup-form-error" role="alert">
              {formError}
            </p>
          )}

          <button
            className="signin-submit signup-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        )}

        {!registeredEmail && (
          <p className="auth-switch">
            Already have an account? <Link to="/signin">Sign In</Link>
          </p>
        )}
      </section>
    </div>
  )
}

export default SignUp
