
import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthContext } from './authContext.js'
import { getCurrentUser, updateUserProfile } from '../api/users.js'
import { sessionWithProfile } from '../utils/profile.js'

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

export function AuthProvider({ children, profileUpdatesEnabled = true }) {
  const [session, setSession] = useState(restoreSession)
  const sessionRef = useRef(session)
  const profileRequest = useRef(false)

  // Reconcile a restored session with PostgreSQL; transient failures keep the cached profile.
  useEffect(() => {
    const original = sessionRef.current
    if (!original) return
    let cancelled = false
    getCurrentUser(original.token).then((account) => {
      if (cancelled || profileRequest.current || sessionRef.current !== original) return
      const updated = sessionWithProfile(original, account)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
      sessionRef.current = updated
      setSession(updated)
    }).catch(() => {
      // A failed refresh must not overwrite the current profile or resurrect a signed-out session.
    })
    return () => { cancelled = true }
  }, [])

  const user = session?.user ?? null
  const token = session?.token ?? null

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: user !== null,
      canUpdateProfile: profileUpdatesEnabled,

      async updateProfile(values) {
        if (!profileUpdatesEnabled) throw new Error('Profile saving requires backend support and is not available yet.')
        const original = sessionRef.current
        if (!original) throw new Error('Please sign in before updating your profile.')
        if (profileRequest.current) throw new Error('A profile update is already in progress.')
        profileRequest.current = true
        try {
          const response = await updateUserProfile(values, original.token)
          if (sessionRef.current !== original) throw new Error('Your session changed. Please reopen your profile.')
          const updated = sessionWithProfile(original, response)
          // Cache only a confirmed server response, following the existing session convention.
          try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
          } catch {
            throw new Error('Your profile was saved on the server, but this browser could not refresh your session. Sign in again to reload it.')
          }
          sessionRef.current = updated
          setSession(updated)
          return updated.user
        } finally {
          profileRequest.current = false
        }
      },

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
        const authenticatedUser = await getCurrentUser(data.access_token)
        if (authenticatedUser.id !== payload.sub) throw new Error('Profile response does not match the signed-in account.')

        const newSession = {
          user: authenticatedUser,
          token: data.access_token,
        }

        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify(newSession),
        )

        sessionRef.current = newSession
        setSession(newSession)

        return authenticatedUser
      },

      // Register a new student account with a .edu email.
      // The backend sends a 6-digit verification email and returns the user.
      async signUp({ email, username, displayName, password }) {
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
        sessionRef.current = null
        setSession(null)
      },
    }),
    [user, token, profileUpdatesEnabled],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
