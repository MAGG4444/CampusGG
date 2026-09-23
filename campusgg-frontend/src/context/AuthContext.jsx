import { useMemo, useState } from 'react'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn(email) {
        setUser({
          id: 1,
          username: 'CampusUser',
          displayName: 'Campus User',
          email: email.trim(),
          bio: 'Looking for people on campus to play games with.',
          favoriteGames: ['Valorant', 'CS2'],
          skillLevel: 'Intermediate',
        })
      },
      signOut() {
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
