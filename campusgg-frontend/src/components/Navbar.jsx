import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Gamepad2,
  LogIn,
  MailCheck,
  MessageCircle,
  MessageSquareText,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import './Navbar.css'

const PENDING_EMAIL_KEY = 'campusgg-pending-email'

const navItems = [
  { to: '/matchmaking', label: 'Matchmaking', icon: Gamepad2 },
  { to: '/lobby', label: 'Lobby', icon: UsersRound },
  { to: '/forum', label: 'Forum', icon: MessageSquareText },
  { to: '/chat', label: 'Connection', icon: MessageCircle },
]

function Navbar({ headerRef }) {
  const { isAuthenticated } = useAuth()
  // useLocation causes this component to re-render when the page changes,
  // including right after signup stores the pending verification email.
  useLocation()

  const hasPendingVerification =
    !isAuthenticated && Boolean(sessionStorage.getItem(PENDING_EMAIL_KEY))

  const authItem = isAuthenticated
    ? { to: '/profile', label: 'Profile', variant: 'login', icon: UserRound }
    : { to: '/signin', label: 'Sign In', variant: 'login', icon: LogIn }

  const visibleItems = [
    ...navItems,
    ...(hasPendingVerification
      ? [{ to: '/verify-email', label: 'Verify Email', icon: MailCheck }]
      : []),
    authItem,
  ]

  return (
    <header className="topbar" ref={headerRef}>
      <div className="topbar-inner">
        <Link className="brand" to="/" aria-label="CampusGG home">
          <span className="brand-mark" aria-hidden="true">
            <Gamepad2 size={21} strokeWidth={2.2} />
          </span>
          <span className="brand-word">Campus<span>GG</span></span>
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          {visibleItems.map((item) => {
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
