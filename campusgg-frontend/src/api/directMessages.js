import { request } from './request.js'

function message(item) {
  if (!item || typeof item.id !== 'string' || typeof item.senderId !== 'string' || typeof item.recipientId !== 'string' || typeof item.content !== 'string' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('Invalid message response')
  return { ...item, text: item.content, timestamp: new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
}
export async function listConversations(token, options = {}) {
  const data = await request('/direct-messages', { ...options, token })
  if (!Array.isArray(data?.items)) throw new Error('Invalid conversation list')
  return data.items.map(item => {
    if (!item.user?.id || item.id !== item.user.id || typeof item.user.username !== 'string' || !Number.isInteger(item.unreadCount) || item.unreadCount < 0) throw new Error('Invalid conversation')
    const last = message(item.lastMessage)
    return { id: item.id, username: item.user.displayName || item.user.username, handle: item.user.username, details: { bio: item.user.bio }, lastMessage: last.text, timestamp: last.timestamp, unreadCount: item.unreadCount, messages: [] }
  })
}
export async function getHistory(token, id, { before, ...options } = {}) {
  const params = new URLSearchParams({ limit: '50' })
  if (before) params.set('before', before)
  const data = await request(`/direct-messages/${encodeURIComponent(id)}?${params}`, { ...options, token })
  if (!Array.isArray(data?.items) || !(data.nextBefore === null || typeof data.nextBefore === 'string')) throw new Error('Invalid message history')
  return { items: data.items.map(message), nextBefore: data.nextBefore }
}
export async function postMessage(token, id, content, options = {}) {
  return message(await request(`/direct-messages/${encodeURIComponent(id)}`, { ...options, token, method: 'POST', body: JSON.stringify({ content }) }))
}
export function readMessages(token, id, messageIds, options = {}) {
  return request(`/direct-messages/${encodeURIComponent(id)}/read`, { ...options, token, method: 'PATCH', body: JSON.stringify({ messageIds }) })
}
