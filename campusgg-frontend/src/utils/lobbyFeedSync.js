export function startLobbyFeedSync({ load, onError, document, window, interval = 10000 }) {
  let active = true
  let request = null
  let timer

  function clearTimer() { window.clearTimeout(timer) }
  function refresh() {
    if (!active || document.visibilityState !== 'visible' || request) return
    clearTimer()
    const controller = new AbortController()
    request = controller
    Promise.resolve().then(() => load(controller.signal)).catch((error) => {
      if (active && !controller.signal.aborted) onError(error)
    }).finally(() => {
      if (request !== controller) return
      request = null
      if (active && document.visibilityState === 'visible') timer = window.setTimeout(refresh, interval)
    })
  }
  function visibility() {
    if (document.visibilityState === 'visible') refresh()
    else {
      clearTimer()
      request?.abort()
      request = null
    }
  }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('focus', refresh)
  refresh()
  const stop = () => {
    active = false
    clearTimer()
    request?.abort()
    request = null
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('focus', refresh)
  }
  stop.refresh = refresh
  return stop
}

export function filterLobbyFeed(lobbies, searchValue, selectedGame, selectedSkill, capacity = 'any', visibility = 'all') {
  const search = searchValue.trim().toLowerCase()
  return lobbies.filter((lobby) => {
    const text = `${lobby.lobbyName ?? ''} ${lobby.userName ?? ''} ${lobby.details ?? ''}`.toLowerCase()
    return (selectedGame === 'All Games' || lobby.game === selectedGame) &&
      (['Most Popular', 'Any Skill'].includes(selectedSkill) || lobby.skillLevel === selectedSkill) &&
      (capacity === 'any' || (capacity === 'unlimited' ? lobby.participantLimit === null : lobby.participantLimit === Number(capacity))) &&
      (visibility === 'all' || lobby.visibility === visibility) &&
      (!search || text.includes(search))
  })
}

export function formatLobbyCapacity(lobby) {
  const count = Number.isInteger(lobby.memberCount) && lobby.memberCount >= 0 ? lobby.memberCount : '?'
  const limit = lobby.participantLimit === null ? '∞' : (Number.isInteger(lobby.participantLimit) ? lobby.participantLimit : '?')
  return `${count} / ${limit} players`
}
