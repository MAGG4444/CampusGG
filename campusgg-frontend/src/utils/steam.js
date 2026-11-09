export const STEAM_PRIVACY_URL = 'https://steamcommunity.com/my/edit/settings'

export const STEAM_LINK_ERRORS = {
  cancelled: 'Steam sign-in was cancelled. No changes were made.',
  invalid_state: 'Your Steam link request expired. Please start again.',
  invalid_openid: 'Steam could not verify the sign-in response. Please try again.',
  steam_validation_failed: 'Steam could not validate your account. Please try again.',
  invalid_steam_id: 'Steam did not return a valid account. Please try again.',
  already_linked: 'That Steam account is already linked to another CampusGG user.',
  user_not_found: 'We could not find your CampusGG account. Please sign in again.',
  unexpected: 'Something went wrong while linking Steam. Please try again.',
}

export function steamLinkFeedback(searchParams) {
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || '')

  const status = params.get('steam')

  if (status === 'linked') {
    return {
      type: 'success',
      message: 'Steam account linked. Your playtime will sync automatically.',
    }
  }

  if (status === 'error') {
    const reason = params.get('reason') || 'unexpected'

    return {
      type: 'error',
      message: STEAM_LINK_ERRORS[reason] || STEAM_LINK_ERRORS.unexpected,
    }
  }

  return null
}

export function formatPlaytime(minutes, hours) {
  const safeMinutes =
    typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
      ? Math.floor(minutes)
      : 0

  if (safeMinutes === 0) return 'No playtime'
  if (safeMinutes < 60) return `${safeMinutes} min`

  const safeHours =
    typeof hours === 'number' && Number.isFinite(hours) && hours >= 0
      ? hours
      : safeMinutes / 60

  return Number.isInteger(safeHours)
    ? `${safeHours} hrs`
    : `${safeHours.toFixed(1)} hrs`
}

export function steamSyncedLabel(fetchedAt) {
  const date = new Date(fetchedAt)

  if (Number.isNaN(date.getTime())) return 'Synced with Steam.'

  return `Last synced ${date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`
}
