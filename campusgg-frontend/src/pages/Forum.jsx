import { useEffect, useState } from 'react'
import { useLocation, useNavigationType, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import ForumSidebar from '../components/ForumSidebar.jsx'
import { useForumChannels } from '../context/forumChannelsContext.js'
import ChannelFeed from '../components/ChannelFeed.jsx'
import ForumFeed from '../components/ForumFeed.jsx'
import { clearForumFeed, takeForumFeed } from '../utils/forumFeedReturn.js'
import './Lobby.css'
import './Forum.css'

export default function Forum() {
  const { token } = useAuth()
  const { slug } = useParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const [restore] = useState(() => takeForumFeed(token || 'guest', `${location.pathname}${location.search}`, navigationType === 'POP' || location.state?.restoreForumFeed))
  const currentRestore = restore?.account === (token || 'guest') && restore.route === `${location.pathname}${location.search}` ? restore : null
  useEffect(() => { if (restore) clearForumFeed(restore) }, [restore])
  const { channels, error: channelError } = useForumChannels()
  return (
    <div className="forum-container">
      <div className="forum-layout">
        <ForumSidebar slug={slug} channels={channels} channelError={channelError} />
        <div className="forum-feed-column">{slug ? <ChannelFeed key={`${slug}:${token || ''}`} slug={slug} token={token} restore={currentRestore} /> : <ForumFeed restore={currentRestore} />}</div>
      </div>
    </div>
  )
}
