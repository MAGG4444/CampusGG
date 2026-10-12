const DEFAULT_API_BASE_URL = 'http://localhost:3000'
const REGISTER_PATH = '/api/auth/register'

function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  return (configuredBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
}

function extractMessages(body) {
  if (!body || typeof body !== 'object') return []

  if (Array.isArray(body.message)) {
    return body.message.filter((message) => typeof message === 'string' && message.trim())
  }

  return typeof body.message === 'string' && body.message.trim() ? [body.message] : []
}

export class RegistrationApiError extends Error {
  constructor(message, { status = 0, messages = [message] } = {}) {
    super(message)
    this.name = 'RegistrationApiError'
    this.status = status
    this.messages = messages
  }
}

export async function registerUser(registrationData) {
  let response

  try {
    response = await fetch(`${getApiBaseUrl()}${REGISTER_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationData),
    })
  } catch {
    throw new RegistrationApiError(
      'Unable to reach CampusGG. Check your connection and try again.',
    )
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // An empty or non-JSON error response is handled with a safe fallback below.
  }

  if (!response.ok) {
    const messages = extractMessages(body)
    const fallbackMessage =
      response.status >= 500
        ? 'CampusGG could not create your account right now. Please try again.'
        : 'We could not create your account. Review your details and try again.'

    throw new RegistrationApiError(messages.join(' ') || fallbackMessage, {
      status: response.status,
      messages: messages.length ? messages : [fallbackMessage],
    })
  }

  return body
}
