import { request } from './request.js'

function queryString(params) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  }
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

export function getLobbyRecommendations(token, { game, limit, signal } = {}, fetchImpl) {
  if (!token) throw new Error('Please sign in to see recommendations.')
  return request(`/recommendations/lobbies${queryString({ game, limit })}`, {
    token,
    signal,
    fetchImpl,
  })
}

export function getSuggestedUsers(token, { game, limit, signal } = {}, fetchImpl) {
  if (!token) throw new Error('Please sign in to see suggested teammates.')
  return request(`/recommendations/users${queryString({ game, limit })}`, {
    token,
    signal,
    fetchImpl,
  })
}

export function quickJoin(token, { game } = {}, fetchImpl) {
  if (!token) throw new Error('Please sign in to find a squad.')
  return request('/recommendations/quick-join', {
    method: 'POST',
    token,
    fetchImpl,
    body: JSON.stringify(game ? { game } : {}),
  })
}
