import { request } from './request.js'

const relationships = new Set(['friend', 'incoming', 'outgoing', 'none'])
export async function getRecentPlayers(token, options = {}) {
  const data = await request('/connections/recent', { ...options, token })
  if (!Array.isArray(data?.items) || data.items.some(person =>
    typeof person?.id !== 'string' || !person.id || typeof person.name !== 'string' ||
    typeof person.username !== 'string' || !relationships.has(person.relationship) ||
    typeof person.sharedLobby !== 'string' || !(person.sharedGame === null || typeof person.sharedGame === 'string') ||
    typeof person.lastSharedAt !== 'string' || !Number.isFinite(Date.parse(person.lastSharedAt)) ||
    !Number.isSafeInteger(person.sharedSessions) || person.sharedSessions < 1)) {
    throw new Error('Invalid recent players response')
  }
  return data.items
}
