import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import ForumFollowsProvider from '../context/ForumFollowsProvider.jsx'
import { useForumFollows } from '../context/forumFollowsContext.js'
import ForumSidebar from '../components/ForumSidebar.jsx'
import RankedFeed from '../components/RankedFeed.jsx'
import FollowingFeed from '../components/FollowingFeed.jsx'
import ExploreChannels from '../components/ExploreChannels.jsx'
import ChannelFeed from '../components/ChannelFeed.jsx'
import ForumFeed from '../components/ForumFeed.jsx'
import './Lobby.css'
import './Forum.css'

function ForumContent() {
  const follows = useForumFollows()
  const [feed, setFeed] = useState('all')
  const { slug } = useParams()
  const path = useLocation().pathname.replace(/\/+$/, '').toLowerCase()
  const isExplore = path === '/forum/explore'
  const isPopular = path === '/forum/popular'
  const [channels, setChannels] = useState(null)
  const [channelError, setChannelError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/forum/channels`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(response.status === 404 ? 'Channel endpoint not found (404). Check that the backend is up to date.' : `Channel request failed (${response.status}).`); return response.json() })
      .then((data) => { if (!Array.isArray(data)) throw new Error(); if (!controller.signal.aborted) { setChannels(data); setChannelError(false) } })
      .catch((error) => { if (!controller.signal.aborted) setChannelError(error.message || 'Unable to reach the backend.') })
    return () => controller.abort()
  }, [retry, follows.version])
  return (
    <div className="forum-container">
      <div className="forum-layout">
        <ForumSidebar slug={slug} isExplore={isExplore} isPopular={isPopular} channels={channels} channelError={channelError} follows={follows} />
        <div className="forum-feed-column">{isExplore ? <ExploreChannels channels={channels} error={channelError} onRetry={() => { setChannelError(false); setChannels(null); setRetry((value) => value + 1) }} /> : isPopular ? <RankedFeed mode="popular" token={follows.token} catalog={channels || []} /> : slug ? <ChannelFeed key={slug} slug={slug} token={follows.token} channels={channels || []} /> : <><div className="forum-feed-tabs" role="group" aria-label="Forum feeds"><button type="button" aria-pressed={feed === 'all'} onClick={() => setFeed('all')}>{follows.token ? 'For You' : 'All Posts'}</button><button type="button" aria-pressed={feed === 'following'} onClick={() => setFeed('following')}>Following</button></div>{feed === 'all' ? follows.token ? <RankedFeed key={`you:${follows.version}`} mode="for-you" token={follows.token} catalog={channels || []} /> : <ForumFeed channels={channels || []} /> : <FollowingFeed key={follows.version} catalog={channels || []} />}</>}</div>
      </div>
    </div>
  )
}

export default function Forum() {
  const { token, user } = useAuth()
  return <ForumFollowsProvider key={`${user?.id || 'guest'}:${token || ''}`} token={token}><ForumContent /></ForumFollowsProvider>
}
