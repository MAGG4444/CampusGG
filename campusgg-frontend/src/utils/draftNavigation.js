// Scope the bypass to our synchronous save/delete URL replacement, never a later navigation.
export function createDraftNavigationGuard() {
  let replacingDraftUrl = false
  return {
    shouldBlock(dirty, published, { currentLocation, nextLocation }) {
      return dirty && !published && !replacingDraftUrl && (
        currentLocation.pathname !== nextLocation.pathname
        || currentLocation.search !== nextLocation.search
      )
    },
    replaceDraftUrl(replace) {
      replacingDraftUrl = true
      try {
        return replace()
      } finally {
        replacingDraftUrl = false
      }
    },
  }
}
