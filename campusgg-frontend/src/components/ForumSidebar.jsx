import { useState } from 'react'
import { Compass, Home, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import ChannelLogo from './ChannelLogo.jsx'

export default function ForumSidebar({ slug, isExplore, isPopular, channels, channelError, follows }) {
  const [expanded, setExpanded] = useState(false)
  const sorted = [...(channels || [])].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const shown = expanded ? sorted : sorted.slice(0, 2)
  const remaining = sorted.length - 2
  return <nav className="forum-sidebar" aria-label="Forum navigation">
    <p className="forum-nav-label">Main navigation</p>
    <Link className={`forum-nav-item ${!slug && !isExplore && !isPopular ? 'is-active' : ''}`} to="/forum" aria-current={!slug && !isExplore && !isPopular ? 'page' : undefined}><Home size={18} aria-hidden="true" /> Home</Link>
    <Link className={`forum-nav-item ${isPopular ? 'is-active' : ''}`} to="/forum/popular" aria-current={isPopular ? 'page' : undefined}><TrendingUp size={18} aria-hidden="true" /> Popular</Link>
    <Link className={`forum-nav-item ${isExplore ? 'is-active' : ''}`} to="/forum/explore" aria-current={isExplore ? 'page' : undefined}><Compass size={18} aria-hidden="true" /> Explore</Link>
    <div className="forum-channels">
      <p className="forum-nav-label">My Channels</p>
      {!follows.token ? <p><Link to="/signin">Sign in</Link> to follow channels.</p> : follows.loading ? <p role="status">Loading channels...</p> : follows.error ? <p>{follows.error} <button type="button" onClick={follows.refresh}>Retry</button></p> : follows.channels.length ? <div className="forum-followed-list">{follows.channels.map((channel) => <Link key={channel.id} className="forum-nav-item" to={`/forum/channel/${channel.slug}`}><ChannelLogo channel={channel} small /><span className="forum-nav-name">{channel.name}</span></Link>)}</div> : <p>No followed channels. <Link to="/forum/explore">Explore games</Link></p>}
    </div>
    <div className="forum-channel-list">
      <p className="forum-nav-label">Game Channels</p>
      {channelError && <p className="forum-channel-error">Channels unavailable.</p>}
      <div id="forum-game-channels">{shown.map((channel) => <Link key={channel.id} className={`forum-nav-item ${slug === channel.slug ? 'is-active' : ''}`} to={`/forum/channel/${channel.slug}`} aria-current={slug === channel.slug ? 'page' : undefined}><ChannelLogo channel={channel} small /><span className="forum-nav-name">{channel.name}</span></Link>)}</div>
      {remaining > 0 && <button className="forum-channels-expand" type="button" aria-expanded={expanded} aria-controls="forum-game-channels" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show Less' : `Show ${remaining} more`}</button>}
    </div>
  </nav>
}
