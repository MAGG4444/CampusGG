import { useState } from 'react'
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
import { useForumChannels } from '../context/forumChannelsContext.js'
import ChannelLogo from './ChannelLogo.jsx'
import './Navbar.css'

const PENDING_EMAIL_KEY = 'campusgg-pending-email'

const navItems = [
  { to: '/lobby', label: 'Lobby', icon: UsersRound },
  { to: '/forum', label: 'Forum', icon: MessageSquareText },
  { to: '/chat', label: 'Connection', icon: MessageCircle },
]

function Navbar({ headerRef }) {
  const { isAuthenticated } = useAuth()
  const { channels, error, retry } = useForumChannels()
  const [forumOpen, setForumOpen] = useState(false)
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
            if (item.to === '/forum') return (
              <div className={`nav-forum ${forumOpen ? 'is-open' : ''}`} key={item.to} onMouseEnter={() => setForumOpen(true)} onMouseLeave={() => setForumOpen(false)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setForumOpen(false) }} onKeyDown={(event) => { if (event.key === 'Escape') { setForumOpen(false); event.currentTarget.querySelector('a')?.focus() } }}>
                <NavLink className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} to="/forum" aria-controls="nav-forum-channels" aria-expanded={forumOpen} aria-keyshortcuts="ArrowDown" title="Forum (press Down Arrow for game channels)" onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setForumOpen(true); const region = event.currentTarget.parentElement; requestAnimationFrame(() => region.querySelector('.nav-forum-menu a, .nav-forum-menu button')?.focus()) } }} onClick={() => setForumOpen(false)}><Icon size={17} aria-hidden="true" />Forum</NavLink>
                <div className={`nav-forum-menu ${forumOpen ? 'is-open' : ''}`} id="nav-forum-channels" aria-label="Game channels" aria-hidden={!forumOpen} inert={!forumOpen}>
                  {error ? <p role="alert">{error} <button type="button" onClick={retry}>Retry</button></p> : !channels ? <p role="status">Loading channels...</p> : channels.length === 0 ? <p>No channels available.</p> : channels.map((channel) => <Link key={channel.id} to={`/forum/channel/${channel.slug}`} onClick={() => setForumOpen(false)}><ChannelLogo channel={channel} small />{channel.name}</Link>)}
                </div>
              </div>
            )
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
