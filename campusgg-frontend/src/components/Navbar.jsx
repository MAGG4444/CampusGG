import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import './Navbar.css'

const navItems = [
  { to: '/lobby', label: 'Lobby' },
  { to: '/forum', label: 'Forum' },
]

function Navbar() {
  const { isAuthenticated } = useAuth()
  const authItem = isAuthenticated
    ? { to: '/profile', label: 'Profile', variant: 'login' }
    : { to: '/signin', label: 'Sign In', variant: 'login' }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" to="/">
          CampusGG
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          {[...navItems, authItem].map((item) => (
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
