import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import VersionLabel from './VersionLabel.jsx'

function Layout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
      <footer className="app-footer">
        <VersionLabel />
      </footer>
    </div>
  )
}

export default Layout
