import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import FollowButton from './FollowButton.jsx'
import ChannelLogo from './ChannelLogo.jsx'
import { channelPresentation, selectCommunitySections } from '../utils/channelPresentation.js'
import { useForumFollows } from '../context/forumFollowsContext.js'

function CommunityCard({ channel }) {
  return <li className="community-card">
    <Link className="community-card-link" to={`/forum/channel/${channel.slug}`} aria-label={`Open ${channel.name} channel`} />
    <div className="community-card-header">
      <ChannelLogo channel={channel} />
      <div className="community-card-title"><strong>{channel.name}</strong><span>{channel.followerCount} {channel.followerCount === 1 ? 'follower' : 'followers'}</span></div>
      <FollowButton channel={channel} />
    </div>
    <p>{channelPresentation[channel.id]?.description || `Join the ${channel.name} community.`}</p>
  </li>
}

function Section({ title, channels }) {
  if (!channels.length) return null
  return <section className="community-section"><h2>{title}</h2><ul className="community-grid">{channels.map((channel) => <CommunityCard key={channel.id} channel={channel} />)}</ul></section>
}

export default function ExploreChannels({ channels, error, onRetry }) {
  const follows = useForumFollows()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All Games')
  const categories = useMemo(() => [...new Set((channels || []).map((channel) => channel.category).filter(Boolean))].sort(), [channels])
  const query = search.trim().toLowerCase()
  const results = (channels || []).filter((channel) => (category === 'All Games' || channel.category === category) && [channel.name, ...(channel.aliases || [])].some((value) => value.toLowerCase().includes(query)))
  const { personalized, recommended, mostFollowed } = selectCommunitySections(channels || [], follows)
  const showFeatured = !query && category === 'All Games'
  return <section className="forum-page forum-explore">
    <header className="forum-header"><h1>Explore Communities</h1></header>
    {error ? <div className="forum-explore-state" role="alert"><p>Unable to load game channels. {typeof error === 'string' ? error : ''}</p><button type="button" onClick={onRetry}>Try again</button></div> : channels === null ? <div className="forum-explore-state" role="status">Loading channels...</div> : channels.length === 0 ? <div className="forum-explore-state">No game channels are available yet.</div> : <>
      <div className="explore-search"><Search size={19} aria-hidden="true" /><input type="search" aria-label="Search game communities" placeholder="Search game communities" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="explore-categories" role="group" aria-label="Game categories">{['All Games', ...categories].map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {follows?.error && <div role="alert" className="forum-follow-error">{follows.error} <button type="button" onClick={follows.refresh}>Retry</button></div>}
      {showFeatured && <><Section title={personalized ? 'Recommended for You' : 'Discover Communities'} channels={recommended} /><Section title="Most Followed Communities" channels={mostFollowed} /></>}
      <section className="community-section"><h2>All Game Communities</h2>{results.length === 0 ? <div className="forum-explore-state" role="status">No communities match your search or category.</div> : <ul className="community-grid">{results.map((channel) => <CommunityCard key={channel.id} channel={channel} />)}</ul>}</section>
    </>}
  </section>
}
