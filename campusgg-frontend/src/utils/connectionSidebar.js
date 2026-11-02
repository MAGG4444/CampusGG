const AUTH_ROUTES = new Set(['/signin', '/signup', '/verify-email'])

export function canShowConnectionSidebar(isAuthenticated, pathname) {
  return Boolean(isAuthenticated) && !AUTH_ROUTES.has(pathname)
}
