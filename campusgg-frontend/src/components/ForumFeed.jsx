import { useState } from 'react'
import SearchBar from './SearchBar.jsx'
import InfinitePostList from './InfinitePostList.jsx'
import { useAuth } from '../context/useAuth.js'
import ForumSort from './ForumSort.jsx'
import ForumTableHeader from './ForumTableHeader.jsx'
import ForumStickyHeader from './ForumStickyHeader.jsx'
import { Link } from 'react-router-dom'

export default function ForumFeed({ restore }) {
  const [search, setSearch] = useState(restore?.search || '')
  const [sort, setSort] = useState(restore?.sort || 'new')
  const [revision, setRevision] = useState(restore?.revision || 0)
  const { token } = useAuth()
  const query = new URLSearchParams({ sort, search: search.trim() })
  const url = `/forum/feed/all?${query}`
  return <section className="forum-page" role="table" aria-label="Forum home posts">
    <h1 className="sr-only">Forum Home</h1>
    <ForumStickyHeader><div className="forum-channel-toolbar forum-home-toolbar" aria-label="Forum browsing controls">
      <ForumSort value={sort} onChange={(value) => { setSort(value); setRevision((current) => current + 1) }} />
      <SearchBar value={search} onChange={setSearch} label="Search posts" placeholder="Search posts" maxLength={200} />
      <Link className="create-lobby-button forum-create-link" to="/create-post">+ Create Post</Link>
    </div><ForumTableHeader /></ForumStickyHeader>
    <InfinitePostList key={`${token || 'guest'}:${revision}:${url}`} url={url} scope={`${token || 'guest'}:${revision}`} restore={restore} feedState={{ search, sort, revision }} showRefresh={false} emptyMessage={search.trim() ? 'No posts match your search.' : 'No posts found.'} />
  </section>
}
