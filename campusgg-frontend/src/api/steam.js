import { request } from './request.js'

export async function getSteamLinkUrl(token, fetchImpl) {
  if (!token) throw new Error('Please sign in before linking Steam.')

  const data = await request('/steam/link', { token, fetchImpl })

  if (!data || typeof data.url !== 'string' || !data.url) {
    throw new Error('Invalid Steam link response from server.')
  }

  return data.url
}

export async function getSteamStats(
  token,
  { top = 10, refresh = false, signal, fetchImpl } = {},
) {
  if (!token) throw new Error('Please sign in to view Steam stats.')

  const params = new URLSearchParams({ top: String(top) })
  if (refresh) params.set('refresh', 'true')

  const data = await request(`/steam/stats?${params.toString()}`, {
    token,
    signal,
    fetchImpl,
  })

  if (!data || typeof data.status !== 'string') {
    throw new Error('Invalid Steam stats response from server.')
  }

  return data
}

export async function unlinkSteamAccount(token, fetchImpl) {
  if (!token) throw new Error('Please sign in before unlinking Steam.')

  const data = await request('/steam/link', {
    method: 'DELETE',
    token,
    fetchImpl,
  })

  if (!data || data.status !== 'NOT_LINKED') {
    throw new Error('Invalid Steam unlink response from server.')
  }

  return data
}
