
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  return <MembershipProvider key={`${userId ?? ''}:${token ?? ''}`} userId={userId} token={token}>{children}</MembershipProvider>
}

function MembershipProvider({ children, userId, token }) {
  const currentUserRef = useRef(userId)
  useLayoutEffect(() => {
    currentUserRef.current = userId
    return () => { currentUserRef.current = null }
  }, [userId])
  const revisionRef = useRef(0)

  const [membershipState, setMembershipState] = useState({
    userId: null,
    roles: {},
  })

  // Keep memberships separate when different users sign in.
  const roles = useMemo(
    () => membershipState.userId === userId ? membershipState.roles : {},
    [membershipState, userId],
  )
  const joinedLobbyIds = useMemo(() => Object.keys(roles), [roles])

  const updateMembership = useCallback(
    (lobbyId, role) => {
      if (!userId || currentUserRef.current !== userId) return
      revisionRef.current += 1

      const id = String(lobbyId)

      setMembershipState((current) => {
        const roles = { ...(current.userId === userId ? current.roles : {}) }
        if (role) roles[id] = role
        else delete roles[id]

        return {
          userId,
          roles,
        }
      })
    },
    [userId],
  )

  // Retrieve real memberships from PostgreSQL.
  const refreshLobbyMembers = useCallback(
    async (lobbyId, signal) => {
      const id = String(lobbyId)
      const revision = ++revisionRef.current

      let members
      try {
        members = await authenticatedRequest(
          `/lobbies/${encodeURIComponent(id)}/members`,
          token,
          { signal },
        )
      } catch (error) {
        if (error.status === 404 && !signal?.aborted && currentUserRef.current === userId && revision === revisionRef.current) {
          updateMembership(id, null)
        }
        throw error
      }

      if (!Array.isArray(members)) {
        throw new Error('Invalid membership data received.')
      }

      const membership = members.find((member) => member.id === userId)
      if (!signal?.aborted && currentUserRef.current === userId && revision === revisionRef.current) updateMembership(id, membership?.role ?? null)

      return members
    },
    [token, userId, updateMembership],
  )

  const refreshMemberships = useCallback(async (signal) => {
    if (!token || !userId) return
    const revision = ++revisionRef.current
    const memberships = await authenticatedRequest('/lobbies/memberships/me', token, { signal })
    if (!Array.isArray(memberships)) throw new Error('Invalid membership data received.')
    if (signal?.aborted || currentUserRef.current !== userId || revision !== revisionRef.current) return
    const roles = Object.fromEntries(memberships.map(({ lobbyId, role }) => [String(lobbyId), role]))
    setMembershipState((current) => {
      if (current.userId === userId && JSON.stringify(current.roles) === JSON.stringify(roles)) return current
      return { userId, roles }
    })
    return roles
  }, [token, userId])

  const joinLobby = useCallback(
    async (lobbyId, signal) => {
      const id = String(lobbyId)

      await authenticatedRequest(
        `/lobbies/${encodeURIComponent(id)}/join`,
        token,
        { method: 'POST', signal },
      )

      if (!signal?.aborted) updateMembership(id, 'member')
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

      updateMembership(id, null)
    },
    [token, updateMembership],
  )

  const deleteLobby = useCallback(async (lobbyId) => {
    const id = String(lobbyId)
    await authenticatedRequest(`/lobbies/${encodeURIComponent(id)}`, token, { method: 'DELETE' })
    updateMembership(id, null)
  }, [token, updateMembership])

  const forgetLobby = useCallback((lobbyId) => updateMembership(lobbyId, null), [updateMembership])

  const value = useMemo(
    () => ({
      joinedLobbyIds,
      isLobbyJoined(lobbyId) {
        return joinedLobbyIds.includes(String(lobbyId))
      },
      getLobbyRole(lobbyId) {
        return roles[String(lobbyId)] ?? null
      },
      refreshMemberships,
      forgetLobby,
      joinLobby,
      leaveLobby,
      deleteLobby,
      refreshLobbyMembers,
    }),
    [
      joinedLobbyIds,
      roles,
      refreshMemberships,
      forgetLobby,
      joinLobby,
      leaveLobby,
      deleteLobby,
      refreshLobbyMembers,
    ],
  )

  return (
    <JoinedLobbiesContext.Provider value={value}>
      {children}
    </JoinedLobbiesContext.Provider>
  )
}
