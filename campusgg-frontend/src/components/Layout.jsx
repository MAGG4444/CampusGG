import { useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { canShowConnectionSidebar } from '../utils/connectionSidebar.js'
import ConnectionSidebar from './ConnectionSidebar.jsx'
import Navbar from './Navbar.jsx'
import VersionLabel from './VersionLabel.jsx'
import ChatProvider from '../context/ChatProvider.jsx'

function Layout() {
  const { isAuthenticated, user } = useAuth()
  const { pathname } = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const headerRef = useRef(null)
  const workspaceRef = useRef(null)
  const showConnectionSidebar = canShowConnectionSidebar(
    isAuthenticated,
    pathname,
  )

  useLayoutEffect(() => {
    const header = headerRef.current
    const workspace = workspaceRef.current
    if (!header || !workspace) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const bottom = Math.max(0, Math.min(window.innerHeight, header.getBoundingClientRect().bottom))
      workspace.style.setProperty('--connection-sidebar-top', `${bottom}px`)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(header)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [user?.id])

  return (
    <ChatProvider key={user?.id ?? 'guest'}><div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar headerRef={headerRef} />
      <div className={`app-workspace ${
        showConnectionSidebar && isSidebarOpen
          ? 'app-workspace-sidebar-open'
          : ''
      }`} ref={workspaceRef}>
        <main className="app-main" id="main-content">
          <Outlet />
        </main>
        {showConnectionSidebar ? (
          <ConnectionSidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen((open) => !open)}
          />
        ) : null}
      </div>
      <footer className="app-footer">
        <VersionLabel />
      </footer>
    </div></ChatProvider>
  )
}

export default Layout
