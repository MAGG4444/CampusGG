import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  },
  {
    name: 'displayName',
    label: 'Display Name',
    type: 'text',
    autoComplete: 'name',
    placeholder: 'Campus Player',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
    placeholder: 'Create a password',
  },
  {
    name: 'confirmPassword',
    label: 'Confirm Password',
    type: 'password',
    autoComplete: 'new-password',
    placeholder: 'Re-enter your password',
  },
]

function validate(values) {
  const errors = {}
  const email = values.email.trim()

  if (!email) {
    errors.email = 'Enter your .edu email address.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  } else if (!email.toLowerCase().endsWith('.edu')) {
    errors.email = 'Use an email address that ends in .edu.'
  }

  if (!values.username.trim()) errors.username = 'Enter a username.'
  if (!values.displayName.trim()) errors.displayName = 'Enter your display name.'
  if (!values.password) errors.password = 'Enter a password.'

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

function SignUp() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setValues((currentValues) => ({ ...currentValues, [name]: value }))
    setErrors((currentErrors) => {
      if (!currentErrors[name]) return currentErrors

      const nextErrors = { ...currentErrors }
      delete nextErrors[name]
      return nextErrors
    })
    setSuccessMessage('')
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = validate(values)
    setErrors(nextErrors)
    setSuccessMessage('')

    const firstInvalidField = fields.find((field) => nextErrors[field.name])
    if (firstInvalidField) {
      event.currentTarget.elements.namedItem(firstInvalidField.name)?.focus()
      return
    }

    setSuccessMessage(
      'Registration form is ready. Account creation will be connected in the next step.',
    )
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

        <form className="signup-form" noValidate onSubmit={handleSubmit}>
          <div className="signup-form-grid">
            {fields.map((field) => {
              const errorId = `signup-${field.name}-error`

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
                    aria-invalid={errors[field.name] ? 'true' : undefined}
                    aria-describedby={errors[field.name] ? errorId : undefined}
                    required
                  />
                  {errors[field.name] && (
                    <span className="signup-field-error" id={errorId}>
                      {errors[field.name]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <button className="signin-submit signup-submit" type="submit">
            Sign Up
          </button>

          {successMessage && (
            <p className="signup-success" role="status">
              {successMessage}
            </p>
          )}
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/signin">Sign In</Link>
        </p>
      </section>
    </div>
  )
}

export default SignUp
