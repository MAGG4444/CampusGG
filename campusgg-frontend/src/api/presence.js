import { request } from './request.js'

export async function getFriendPresence(token, options = {}) {
  const data = await request('/presence/friends', { ...options, token })
  if (!Array.isArray(data?.items)) throw new Error('Invalid presence response')
  const result = new Map()
  for (const item of data.items) {
    if (typeof item?.userId !== 'string' || !item.userId || !(item.online === null || typeof item.online === 'boolean')) throw new Error('Invalid presence status')
    if (typeof item.online === 'boolean') result.set(item.userId, item.online)
  }
  return result
}
