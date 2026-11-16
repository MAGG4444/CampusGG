import { useState } from 'react'
import SearchBar from './SearchBar.jsx'
import InfinitePostList from './InfinitePostList.jsx'

export default function ForumFeed({ channels = [] }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('new')
  const query = new URLSearchParams({ sort, search: search.trim() })
  const url = `/forum/feed/all?${query}`
  return <section className="forum-page">
    <header className="forum-header"><h1>Forum</h1></header>
    <div className="forum-controls"><SearchBar value={search} onChange={setSearch} /><div className="forum-control-selects"><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="new">Newest</option><option value="replies">Most Replies</option><option value="liked">Most Liked</option></select></label></div></div>
    <div className="forum-feed-heading">All posts</div>
    <InfinitePostList key={url} url={url} scope="guest" catalog={channels} emptyMessage={search.trim() ? 'No posts match your search.' : 'No posts found.'} />
  </section>
}
