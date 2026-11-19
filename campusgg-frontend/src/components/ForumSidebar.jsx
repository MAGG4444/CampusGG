import { Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import ChannelLogo from './ChannelLogo.jsx'

export default function ForumSidebar({ slug, channels, channelError }) {
  const sorted = [...(channels || [])].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return <nav className="forum-sidebar" aria-label="Forum navigation">
    <Link className={`forum-nav-item ${!slug ? 'is-active' : ''}`} to="/forum" aria-current={!slug ? 'page' : undefined}><Home size={18} aria-hidden="true" />Home</Link>
    <div className="forum-channel-list">
      <p className="forum-nav-label">Game Channels</p>
      {channelError && <p className="forum-channel-error">Channels unavailable.</p>}
      {!channels && !channelError && <p role="status">Loading channels...</p>}
      {channels && channels.length === 0 && <p>No channels available.</p>}
      <div id="forum-game-channels">{sorted.map((channel) => <Link key={channel.id} className={`forum-nav-item ${slug === channel.slug ? 'is-active' : ''}`} to={`/forum/channel/${channel.slug}`} aria-current={slug === channel.slug ? 'page' : undefined}><ChannelLogo channel={channel} small /><span className="forum-nav-name">{channel.name}</span></Link>)}</div>
    </div>
  </nav>
}
