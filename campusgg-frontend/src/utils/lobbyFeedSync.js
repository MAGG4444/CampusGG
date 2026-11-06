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

export function filterLobbyFeed(lobbies, searchValue, selectedGame, selectedSkill) {
  const search = searchValue.trim().toLowerCase()
  return lobbies.filter((lobby) => {
    const text = `${lobby.lobbyName ?? ''} ${lobby.userName ?? ''} ${lobby.details ?? ''}`.toLowerCase()
    return (selectedGame === 'All Games' || lobby.game === selectedGame) &&
      (selectedSkill === 'Most Popular' || lobby.skillLevel === selectedSkill) &&
      (!search || text.includes(search))
  })
}

export function lobbyFeedPage(lobbies, currentPage, pageSize) {
  const totalPages = Math.max(1, Math.ceil(lobbies.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  return { page, totalPages, items: lobbies.slice((page - 1) * pageSize, page * pageSize) }
}
