const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000'

export function currentLobbyFromFeed(joinedLobbyIds, getLobbyRole, lobbies) {
  const id = joinedLobbyIds[0]
  if (!id) return null
  const lobby = lobbies.find(item => String(item.id) === id)
  return lobby ? { ...lobby, role: getLobbyRole(id) } : null
}

// Verify membership before joining: the feed's last poll may already be stale.
export async function checkCurrentLobby(refreshMemberships, lobbies = [], signal) {
  const roles = await refreshMemberships(signal)
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
  if (!roles) throw new Error('Unable to verify your current lobby. Please try again.')
  let currentRoles = roles
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const id = Object.keys(currentRoles)[0]
    if (!id) return null
    const known = lobbies.find(lobby => String(lobby.id) === id)
    if (known) return { ...known, role: currentRoles[id] }
    const response = await fetch(`${API_URL}/lobbies/${encodeURIComponent(id)}`, { signal })
    if (!response.ok) {
      if (response.status === 404 && attempt === 0) {
        const latest = await refreshMemberships(signal)
        if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
        if (latest && !latest[id]) { currentRoles = latest; continue }
      }
      throw new Error('Unable to load your current lobby. Please try again.')
    }
    const lobby = await response.json()
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    return { ...lobby, role: currentRoles[id] }
  }
  throw new Error('Unable to load your current lobby. Please try again.')
}

export async function attemptLobbyJoin({ lobby, lobbies, refreshMemberships, joinLobby, signal }) {
  const check = () => checkCurrentLobby(refreshMemberships, lobbies, signal)
  const current = await check()
  if (current) return { current }
  try {
    await joinLobby(lobby.id, signal)
  } catch (error) {
    if (signal?.aborted) throw error
    if (error.status !== 409) throw error
    const latest = await check()
    if (latest) return { current: latest }
    throw error
  }
  return { current: null }
}
