import { request } from './request.js'
import { profilePayload } from '../utils/profile.js'

export async function updateUserProfile(values, token, fetchImpl) {
  if (!token) throw new Error('Please sign in before updating your profile.')
  const options = {
    method: 'PATCH',
    token,
    body: JSON.stringify(profilePayload(values)),
  }
  const data = fetchImpl
    ? await requestWith(fetchImpl, '/users/me', options)
    : await request('/users/me', options)
  if (!data || typeof data.id !== 'string' || !data.id) {
    throw new Error('Invalid profile response from server.')
  }
  return { id: data.id, ...profilePayload(data) }
}

export async function getCurrentUser(token, fetchImpl) {
  if (!token) throw new Error('Please sign in to retrieve your profile.')
  const data = fetchImpl
    ? await requestWith(fetchImpl, '/users/me', { token })
    : await request('/users/me', { token })
  if (!data || typeof data.id !== 'string' || !data.id
    || typeof data.username !== 'string' || typeof data.email !== 'string') {
    throw new Error('Invalid profile response from server.')
  }
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    ...profilePayload(data),
  }
}

async function requestWith(fetchImpl, path, { token, ...options }) {
  const response = await fetchImpl(`http://localhost:3000${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new Error(message || 'Unable to update your profile.')
  }
  return data
}
