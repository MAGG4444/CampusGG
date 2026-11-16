import { useEffect, useState } from 'react'
import ChannelLogo from './ChannelLogo.jsx'
import { Link, useNavigate } from 'react-router-dom'
import RankedFeed from './RankedFeed.jsx'
import FollowButton from './FollowButton.jsx'
import { useForumFollows } from '../context/forumFollowsContext.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ChannelFeed({ slug, channels, token }) {
  const follows = useForumFollows()
  const [state, setState] = useState({ loading: true })
  const navigate = useNavigate()

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setState({ loading: true })
      try {
        const path = `${API}/forum/channels/${encodeURIComponent(slug)}`
        const channelResponse = await fetch(path, { signal: controller.signal })
        if (channelResponse.status === 404) throw new Error('Channel not found.')
        if (!channelResponse.ok) throw new Error('Unable to load this channel.')
        const channel = await channelResponse.json()
        if (!controller.signal.aborted) setState({ channel, loading: false })
      } catch (error) {
        if (!controller.signal.aborted) setState({ error: error.message || 'Unable to load this channel.', loading: false })
      }
    }
    load()
    return () => controller.abort()
  }, [slug])

  return <section className="forum-page">
    <Link className="forum-back-link" to="/forum">&larr; Forum home</Link>
    {state.loading ? <div className="feed-state-message" role="status">Loading channel...</div> : state.error ?
      <div className="feed-state-message" role="alert">{state.error}</div> : <>
        <header className="forum-header forum-channel-header">
          <div className="forum-channel-title"><ChannelLogo channel={state.channel} size="header" /><h1>{state.channel.name}</h1></div>
          <div className="forum-channel-actions"><FollowButton channel={state.channel} /><button className="forum-create-button" type="button" onClick={() => navigate(`/forum/channel/${state.channel.slug}/create-post`)}>+ Create Post</button></div>
        </header>
        {follows?.error && <div className="forum-follow-error" role="alert">{follows.error} <button type="button" onClick={follows.refresh}>Retry</button></div>}
        <div className="forum-feed-heading">Posts</div>
        <RankedFeed mode="channel" slug={slug} token={token} catalog={channels} />
      </>}
  </section>
}
