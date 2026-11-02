
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(restoreSession)
  const sessionRef = useRef(session)
  const profileRequest = useRef(false)

  // Refresh cached profile fields without invalidating an otherwise valid session.
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
      // A transient refresh failure must not discard a valid cached session.
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

      async updateProfile(values) {
        const original = sessionRef.current
        if (!original) throw new Error('Please sign in before updating your profile.')
        if (profileRequest.current) {
          throw new Error('A profile update is already in progress.')
        }
        profileRequest.current = true
        try {
          const response = await updateUserProfile(values, original.token)
          if (sessionRef.current !== original) {
            throw new Error('Your session changed while the profile was saving.')
          }
          const updated = sessionWithProfile(original, response)
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
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

        // Retrieve private profile fields through the authenticated owner route.
        const authenticatedUser = await getCurrentUser(data.access_token)

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
        sessionRef.current = null
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
