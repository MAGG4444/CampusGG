import { Link, NavLink } from 'react-router-dom'
import { Gamepad2, LogIn, MessageSquareText, UserRound, UsersRound } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import './Navbar.css'

const navItems = [
  { to: '/lobby', label: 'Lobby', icon: UsersRound },
  { to: '/forum', label: 'Forum', icon: MessageSquareText },
]

function Navbar() {
  const { isAuthenticated } = useAuth()
  const authItem = isAuthenticated
    ? { to: '/profile', label: 'Profile', variant: 'login', icon: UserRound }
    : { to: '/signin', label: 'Sign In', variant: 'login', icon: LogIn }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" to="/" aria-label="CampusGG home">
          <span className="brand-mark" aria-hidden="true"><Gamepad2 size={21} strokeWidth={2.2} /></span>
          <span className="brand-word">Campus<span>GG</span></span>
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          {[...navItems, authItem].map((item) => {
            const Icon = item.icon
            return (
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
              <Icon size={17} strokeWidth={2} aria-hidden="true" />
              {item.label}
            </NavLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
