
import { useMemo, useState } from 'react'
import { AuthContext } from './authContext.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const SESSION_KEY = 'campusgg-auth'

// Read the JWT payload to obtain the user's ID and expiration.
// The backend remains responsible for verifying JWT signatures.
function decodeToken(token) {
  const encodedPayload = token.split('.')[1]

  if (!encodedPayload) {
    throw new Error('Invalid authentication token')
  }

  return JSON.parse(
    atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')),
  )
}

// Restore a saved session if the JWT has not expired.
function restoreSession() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)

    if (!stored) {
      return null
    }

    const session = JSON.parse(stored)
    const payload = decodeToken(session.token)

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= Date.now() ||
      session.user?.id !== payload.sub
    ) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }

    return session
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(restoreSession)

  const user = session?.user ?? null
  const token = session?.token ?? null

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: user !== null,

      // Authenticate using the NestJS backend.
      async signIn(email, password) {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message

          throw new Error(message || 'Unable to sign in')
        }

        if (!data.access_token) {
          throw new Error('No authentication token received')
        }

        // Extract the authenticated user's UUID.
        const payload = decodeToken(data.access_token)

        if (
          typeof payload.sub !== 'string' ||
          typeof payload.exp !== 'number' ||
          payload.exp * 1000 <= Date.now()
        ) {
          throw new Error('Invalid authentication token')
        }

        // Retrieve the user's real profile from PostgreSQL.
        const userResponse = await fetch(
          `${API_URL}/users/${encodeURIComponent(payload.sub)}`,
          {
            headers: {
              Authorization: `Bearer ${data.access_token}`,
            },
          },
        )

        if (!userResponse.ok) {
          throw new Error('Unable to retrieve user profile')
        }

        const account = await userResponse.json()

        const authenticatedUser = {
          ...account,

          // Frontend-only defaults for fields not yet in the database.
          bio: account.bio ?? '',
          favoriteGames: account.favoriteGames ?? [],
          skillLevel: account.skillLevel ?? '',
        }

        const newSession = {
          user: authenticatedUser,
          token: data.access_token,
        }

        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify(newSession),
        )

        setSession(newSession)

        return authenticatedUser
      },

      // Register a new student account with a .edu email.
      // The backend sends a 6-digit verification email and returns the user.
      async signUp({ email, username, displayName = '', password }) {
        const response = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            username: username.trim(),
            displayName: displayName.trim(),
            password,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message

          throw new Error(message || 'Unable to create account')
        }

        return data
      },

      // Verify a student email using the 6-digit code sent by the backend.
      async verifyEmail(email, code) {
        const response = await fetch(`${API_URL}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code: code.trim(),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message

          throw new Error(message || 'Unable to verify email')
        }

        return data
      },

      // Resend a fresh 6-digit verification code to an unverified account.
      async resendVerification(email) {
        const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message

          throw new Error(message || 'Unable to resend verification code')
        }

        return data
      },

      // End the local authentication session.
      signOut() {
        sessionStorage.removeItem(SESSION_KEY)
        setSession(null)
      },
    }),
    [user, token],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
