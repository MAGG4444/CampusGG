import { useMemo, useState } from 'react'
import { JoinedLobbiesContext } from './joinedLobbiesContext.js'

export function JoinedLobbiesProvider({ children }) {
  const [joinedLobbyIds, setJoinedLobbyIds] = useState([])

  const value = useMemo(
    () => ({
      joinedLobbyIds,
      isLobbyJoined(lobbyId) {
        return joinedLobbyIds.includes(String(lobbyId))
      },
      joinLobby(lobbyId) {
        const lobbyIdText = String(lobbyId)
        setJoinedLobbyIds((currentLobbyIds) =>
          currentLobbyIds.includes(lobbyIdText) ? currentLobbyIds : [...currentLobbyIds, lobbyIdText],
        )
      },
      leaveLobby(lobbyId) {
        const lobbyIdText = String(lobbyId)
        setJoinedLobbyIds((currentLobbyIds) =>
          currentLobbyIds.filter((joinedLobbyId) => joinedLobbyId !== lobbyIdText),
        )
      },
    }),
    [joinedLobbyIds],
  )

  return <JoinedLobbiesContext.Provider value={value}>{children}</JoinedLobbiesContext.Provider>
}
