export function myContentLocation(search) {
  const params = new URLSearchParams(search)
  const value = Number(params.get('page'))
  return {
    tab: ['lobbies', 'drafts'].includes(params.get('tab')) ? params.get('tab') : 'posts',
    page: Number.isInteger(value) && value > 0 && value <= 2147483647 ? value : 1,
  }
}

export function myContentReturnTo(state, fallback) {
  if (typeof state?.from !== 'string' || !/^\/my-content(?:\?|$)/.test(state.from)) return fallback
  const { tab, page } = myContentLocation(state.from.split('?')[1])
  return `/my-content?tab=${tab}&page=${page}`
}

export function draftEditorReturnTo(location, fallback) {
  const fromContent = myContentReturnTo(location.state, null)
  if (fromContent && !fromContent.startsWith('/my-content?tab=drafts')) return fromContent
  return fromContent || location.state?.from === '/drafts'
    || new URLSearchParams(location.search).has('draftId')
    ? '/my-content?tab=drafts' : fallback
}
