import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'

const navItems = [
  { to: '/lobby', label: 'Lobby' },
  { to: '/forum', label: 'Forum' },
  { to: '/profile', label: 'Profile', variant: 'login' },
]

function Navbar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" to="/">
          CampusGG
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                [
                  'nav-link',
                  isActive ? 'nav-link-active' : '',
                  item.variant === 'login' ? 'login-button' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
