let saved = null
const restored = new WeakSet()

export function consumeForumRestore(snapshot) {
  if (restored.has(snapshot)) return false
  restored.add(snapshot)
  return true
}

export function rememberForumFeed(snapshot) {
  saved = snapshot
}

export function takeForumFeed(account, route, returning) {
  if (!saved) return null
  if (!returning || saved.account !== account || saved.route !== route) { saved = null; return null }
  return saved
}

export function clearForumFeed(snapshot) { if (saved === snapshot) saved = null }
