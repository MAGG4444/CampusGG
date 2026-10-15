
import { useCallback, useMemo, useState } from 'react'
import { useAuth } from './useAuth.js'
import { JoinedLobbiesContext } from './joinedLobbiesContext.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function authenticatedRequest(path, token, options = {}) {
  if (!token) {
    throw new Error('Please sign in to continue.')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message

    const error = new Error(
      response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : message || 'Unable to complete the request.',
    )

    error.status = response.status
    throw error
  }

  return data
}

export function JoinedLobbiesProvider({ children }) {
  const { user, token } = useAuth()
  const userId = user?.id ?? null

  const [membershipState, setMembershipState] = useState({
    userId: null,
    ids: [],
  })

  // Keep memberships separate when different users sign in.
  const joinedLobbyIds =
    membershipState.userId === userId
      ? membershipState.ids
      : []

  const updateMembership = useCallback(
    (lobbyId, joined) => {
      if (!userId) return

      const id = String(lobbyId)

      setMembershipState((current) => {
        const previousIds =
          current.userId === userId ? current.ids : []

        const ids = joined
          ? [...new Set([...previousIds, id])]
          : previousIds.filter((existingId) => existingId !== id)

        return {
          userId,
          ids,
        }
      })
    },
    [userId],
  )

  // Retrieve real memberships from PostgreSQL.
  const refreshLobbyMembers = useCallback(
    async (lobbyId) => {
      const id = String(lobbyId)

      const members = await authenticatedRequest(
        `/lobbies/${encodeURIComponent(id)}/members`,
        token,
      )

      if (!Array.isArray(members)) {
        throw new Error('Invalid membership data received.')
      }

      const isMember = members.some(
        (member) => member.id === userId,
      )

      updateMembership(id, isMember)

      return members
    },
    [token, userId, updateMembership],
  )

  const joinLobby = useCallback(
    async (lobbyId) => {
      const id = String(lobbyId)

      await authenticatedRequest(
        `/lobbies/${encodeURIComponent(id)}/join`,
        token,
        { method: 'POST' },
      )

      updateMembership(id, true)
    },
    [token, updateMembership],
  )

  const leaveLobby = useCallback(
    async (lobbyId) => {
      const id = String(lobbyId)

      await authenticatedRequest(
        `/lobbies/${encodeURIComponent(id)}/leave`,
        token,
        { method: 'POST' },
      )

      updateMembership(id, false)
    },
    [token, updateMembership],
  )

  const value = useMemo(
    () => ({
      joinedLobbyIds,
      isLobbyJoined(lobbyId) {
        return joinedLobbyIds.includes(String(lobbyId))
      },
      joinLobby,
      leaveLobby,
      refreshLobbyMembers,
    }),
    [
      joinedLobbyIds,
      joinLobby,
      leaveLobby,
      refreshLobbyMembers,
    ],
  )

  return (
    <JoinedLobbiesContext.Provider value={value}>
      {children}
    </JoinedLobbiesContext.Provider>
  )
}
