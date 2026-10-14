import { useContext } from 'react'
import { JoinedLobbiesContext } from './joinedLobbiesContext.js'

export function useJoinedLobbies() {
  const context = useContext(JoinedLobbiesContext)

  if (!context) {
    throw new Error('useJoinedLobbies must be used within a JoinedLobbiesProvider')
  }

  return context
}
