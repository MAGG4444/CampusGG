import { request } from './request.js'

const relationships = new Set(['none', 'incoming', 'outgoing', 'friend'])
const actions = {
  request: ['POST', '/request/'],
  accept: ['PATCH', '/accept/'],
  decline: ['DELETE', '/decline/'],
  cancel: ['DELETE', '/cancel/'],
  remove: ['DELETE', '/'],
}

async function people(path, token, signal, fetchImpl) {
  const data = await request(path, { token, signal, fetchImpl })
  if (!Array.isArray(data?.items) || data.items.some(person => !person?.id || typeof person.username !== 'string' || typeof person.name !== 'string' || !relationships.has(person.relationship))) {
    throw new Error('Invalid connections response')
  }
  return data.items
}

export async function getConnections(token, { signal, fetchImpl } = {}) {
  const [friends, incoming, outgoing] = await Promise.all([
    people('/connections', token, signal, fetchImpl),
    people('/connections/incoming', token, signal, fetchImpl),
    people('/connections/outgoing', token, signal, fetchImpl),
  ])
  if (friends.some(p => p.relationship !== 'friend') || incoming.some(p => p.relationship !== 'incoming') || outgoing.some(p => p.relationship !== 'outgoing')) throw new Error('Invalid connection list')
  return { friends, incoming, outgoing }
}

export function searchPlayers(token, q, { signal, fetchImpl } = {}) {
  return people(`/connections/search?${new URLSearchParams({ q: q.trim() })}`, token, signal, fetchImpl)
}

export async function changeConnection(token, userId, action, { signal, fetchImpl } = {}) {
  const route = Object.hasOwn(actions, action) ? actions[action] : null
  if (!route || !userId) throw new Error('Invalid connection action')
  const [method, path] = route
  const data = await request(`/connections${path}${encodeURIComponent(userId)}`, { method, token, signal, fetchImpl })
  if (data?.userId !== userId || !relationships.has(data.relationship)) throw new Error('Invalid connection action response')
  return data
}
