import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import InfinitePostList from './InfinitePostList.jsx'
import SearchBar from './SearchBar.jsx'
import ForumSort from './ForumSort.jsx'
import ForumTableHeader from './ForumTableHeader.jsx'
import ForumStickyHeader from './ForumStickyHeader.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ChannelFeed({ slug, token, restore }) {
  const [state, setState] = useState({ loading: true })
  const [tab, setTab] = useState(restore?.tab || 'for-you')
  const [search, setSearch] = useState(restore?.search || '')
  const [sort, setSort] = useState(restore?.sort || 'new')
  const [revision, setRevision] = useState(restore?.revision || 0)
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

  const query = new URLSearchParams({ sort, search: search.trim() })
  const path = `/forum/channels/${encodeURIComponent(slug)}/${tab === 'following' ? 'following/' : ''}posts?${query}`
  const scope = `${token || 'guest'}:${revision}`
  const header = <>
    <header className="forum-channel-toolbar">
      <h1 className="sr-only">{state.channel?.name} channel</h1>
      <ForumSort value={sort} onChange={(value) => { setSort(value); setRevision((v) => v + 1) }} />
      <SearchBar value={search} onChange={(value) => { setSearch(value); setRevision((v) => v + 1) }} label="Search posts" placeholder="Search posts" maxLength={200} />
      <button className="create-lobby-button" type="button" onClick={() => navigate(`/forum/channel/${state.channel.slug}/create-post`)}>+ Create Post</button>
    </header>
    <div className="forum-feed-tabs" role="group" aria-label="Channel feeds"><button type="button" aria-pressed={tab === 'for-you'} onClick={() => setTab('for-you')}>For You</button><button type="button" aria-pressed={tab === 'following'} onClick={() => setTab('following')}>Following</button></div>
  </>
  return <section className="forum-page" role="table" aria-label={state.channel ? `${state.channel.name} channel posts` : 'Game channel posts'}>
    {state.loading ? <div className="feed-state-message" role="status">Loading channel...</div> : state.error ?
      <div className="feed-state-message" role="alert">{state.error}</div> : <>
        <ForumStickyHeader>{header}<ForumTableHeader /></ForumStickyHeader>
        {tab === 'following' && !token ? <p> <Link to="/signin">Sign in</Link> to see followed posts.</p> : <InfinitePostList key={`${scope}:${path}`} url={path} token={tab === 'following' ? token : undefined} scope={scope} restore={restore} feedState={{ tab, search, sort, revision }} followingFeed={tab === 'following'} showRefresh={false} emptyMessage={tab === 'following' ? 'No followed posts match this channel.' : 'No posts found.'} />}
      </>}
  </section>
}
