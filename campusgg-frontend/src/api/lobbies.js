import { request } from './request.js'

export function getMyLobbies(token, { page = 1, limit = 10, signal } = {}) {
  return request(`/lobbies/me?page=${page}&limit=${limit}`, { token, signal })
}
