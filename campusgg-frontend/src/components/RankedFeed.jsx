import { useState } from 'react'
import InfinitePostList from './InfinitePostList.jsx'

export default function RankedFeed({ mode, slug, token, catalog = [] }) {
  const [sort, setSort] = useState(mode === 'channel' ? 'new' : 'hot')
  const [window, setWindow] = useState('all')
  const path = mode === 'for-you' ? '/forum/feed/for-you' : mode === 'popular' ? '/forum/feed/popular' : `/forum/channels/${encodeURIComponent(slug)}/posts`
  const params = new URLSearchParams()
  if (mode !== 'for-you') { params.set('sort', sort); params.set('window', window) }
  const url = params.size ? `${path}?${params}` : path
  const scope = token || 'guest'
  return <section className="forum-page">
    {mode === 'popular' && <header className="forum-header"><h1>Popular</h1></header>}
    {mode === 'for-you' && <header className="forum-header"><h1>Forum</h1></header>}
    {mode !== 'for-you' && <div className="forum-rank-controls">
      <label>Sort <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="new">New</option><option value="hot">Hot</option><option value="top">Top</option></select></label>
      {sort === 'top' && <label>Time <select value={window} onChange={(event) => setWindow(event.target.value)}><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="all">All Time</option></select></label>}
    </div>}
    <InfinitePostList key={`${scope}:${url}`} url={url} token={mode === 'for-you' ? token : undefined} scope={scope} catalog={catalog} />
  </section>
}
