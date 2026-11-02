import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { canShowConnectionSidebar } from '../utils/connectionSidebar.js'
import ConnectionSidebar from './ConnectionSidebar.jsx'
import Navbar from './Navbar.jsx'
import VersionLabel from './VersionLabel.jsx'

function Layout() {
  const { isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const showConnectionSidebar = canShowConnectionSidebar(
    isAuthenticated,
    pathname,
  )

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <div className={`app-workspace ${
        showConnectionSidebar && isSidebarOpen
          ? 'app-workspace-sidebar-open'
          : ''
      }`}>
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
    </div>
  )
}

export default Layout
