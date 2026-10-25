import { profilePayload } from '../utils/profile.js'

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000'

export async function updateUserProfile(values, token, fetchImpl = fetch) {
  if (!token) throw new Error('Please sign in before updating your profile.')
  const response = await fetchImpl(`${API_URL}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(profilePayload(values)),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new Error(typeof message === 'string' && message ? message : 'Unable to save profile. Please try again.')
  }
  if (!data || typeof data.id !== 'string' || !data.id) throw new Error('Invalid profile response from server.')
  return { id: data.id, ...profilePayload(data) }
}

export async function getCurrentUser(token, fetchImpl = fetch) {
  if (!token) throw new Error('Please sign in to retrieve your profile.')
  const response = await fetchImpl(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Unable to retrieve your profile.')
  const data = await response.json()
  if (!data || typeof data.id !== 'string' || !data.id
    || typeof data.username !== 'string' || typeof data.email !== 'string') {
    throw new Error('Invalid profile response from server.')
  }
  return { id: data.id, username: data.username, email: data.email, ...profilePayload(data) }
}
