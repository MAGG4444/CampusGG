import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'

function Layout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
