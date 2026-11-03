const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000'

async function request(lobbyId, token, options = {}) {
  if (!token) throw new Error('Please sign in to use Lobby Chat.')
  const response = await fetch(`${API_URL}/lobbies/${encodeURIComponent(lobbyId)}/messages`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Unable to load Lobby Chat.')
    error.status = response.status
    throw error
  }
  return data
}

export function loadLobbyMessages(lobbyId, token, signal) {
  return request(lobbyId, token, { signal })
}

export function sendLobbyMessage(lobbyId, token, content) {
  return request(lobbyId, token, { method: 'POST', body: JSON.stringify({ content }) })
}
