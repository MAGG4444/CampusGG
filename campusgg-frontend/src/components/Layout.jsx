import { Link, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/lobby', label: 'Lobby' },
  { to: '/create-lobby', label: 'Create Lobby' },
  { to: '/forum', label: 'Forum' },
  { to: '/create-post', label: 'Create Post' },
  { to: '/chat', label: 'Chat' },
  { to: '/profile', label: 'Profile' },
]

function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="app-title" to="/">
          CampusGG
        </Link>
        <nav className="app-nav" aria-label="Temporary navigation">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
