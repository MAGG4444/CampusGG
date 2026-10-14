import { useMemo, useState } from 'react'
import { Clock, Filter } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import { forumPosts } from '../data/forumPosts.js'
import ForumPost from './ForumPost.jsx'
import SearchBar from './SearchBar.jsx'

const POSTS_PER_PAGE = 3

function ForumFeed() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedSort, setSelectedSort] = useState('Newest')
  const [searchValue, setSearchValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [forumFeedback, setForumFeedback] = useState('')
  const [isLoading] = useState(false)
  const [error] = useState(null)

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    const matchingPosts = forumPosts.filter((post) => {
      const matchesCategory = selectedCategory === 'All Categories' || post.category === selectedCategory
      const searchableText = `${post.title} ${post.author} ${post.summary} ${post.category}`.toLowerCase()
      const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })

    return [...matchingPosts].sort((firstPost, secondPost) => {
      if (selectedSort === 'Most Replies') {
        return secondPost.replyCount - firstPost.replyCount
      }

      if (selectedSort === 'Most Liked') {
        return secondPost.likes - firstPost.likes
      }

      return new Date(secondPost.createdAt) - new Date(firstPost.createdAt)
    })
  }, [searchValue, selectedCategory, selectedSort])

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const firstPostIndex = (safeCurrentPage - 1) * POSTS_PER_PAGE
  const visiblePosts = filteredPosts.slice(firstPostIndex, firstPostIndex + POSTS_PER_PAGE)

  function categoryClassName(category) {
    return `filter-chip ${selectedCategory === category ? 'filter-chip-selected' : ''}`
  }

  function sortClassName(sortOption) {
    return `filter-chip ${selectedSort === sortOption ? 'filter-chip-selected' : ''}`
  }

  function selectPage(page) {
    setCurrentPage(Math.min(Math.max(1, page), totalPages))
  }

  function goToPreviousPage() {
    setCurrentPage((page) => Math.max(1, page - 1))
  }

  function goToNextPage() {
    setCurrentPage((page) => Math.min(totalPages, page + 1))
  }

  function handleSelectCategory(category) {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  function handleSelectSort(sortOption) {
    setSelectedSort(sortOption)
    setCurrentPage(1)
  }

  function handleSearchChange(value) {
    setSearchValue(value)
    setCurrentPage(1)
  }

  function handleReadMore(post) {
    navigate(`/forum/${post.id}`)
  }

  function handleReport(post) {
    setForumFeedback(`Report selected for ${post.title} (#${post.id})`)
  }

  return (
    <section className="forum-page page-enter">
      <header className="page-heading">
        <div>
          <p className="page-kicker">Campus conversations</p>
          <h1>Forum</h1>
          <p>Share strategies, find teammates, and keep up with the conversations shaping campus play.</p>
        </div>
        <button className="create-post-button" type="button" onClick={() => navigate('/create-post')}>
          + Create Post
        </button>
      </header>
      <section className="forum-filter-row" aria-label="Forum filters">
        <div className="filter-group" role="group" aria-label="Category filters">
          <Filter className="filter-icon" size={13} strokeWidth={2.3} aria-hidden="true" />
          <button
            className={categoryClassName('All Categories')}
            type="button"
            aria-pressed={selectedCategory === 'All Categories'}
            onClick={() => handleSelectCategory('All Categories')}
          >
            {selectedCategory === 'All Categories' ? '✓ ' : ''}
            All Categories
          </button>
          <button
            className={categoryClassName('Strategy')}
            type="button"
            aria-pressed={selectedCategory === 'Strategy'}
            onClick={() => handleSelectCategory('Strategy')}
          >
            {selectedCategory === 'Strategy' ? '✓ ' : ''}
            Strategy
          </button>
          <button className={categoryClassName('LFG')} type="button" aria-pressed={selectedCategory === 'LFG'} onClick={() => handleSelectCategory('LFG')}>
            {selectedCategory === 'LFG' ? '✓ ' : ''}
            LFG
          </button>
          <button
            className={categoryClassName('Meta Analysis')}
            type="button"
            aria-pressed={selectedCategory === 'Meta Analysis'}
            onClick={() => handleSelectCategory('Meta Analysis')}
          >
            {selectedCategory === 'Meta Analysis' ? '✓ ' : ''}
            Meta Analysis
          </button>
          <button
            className={categoryClassName('Tournaments')}
            type="button"
            aria-pressed={selectedCategory === 'Tournaments'}
            onClick={() => handleSelectCategory('Tournaments')}
          >
            {selectedCategory === 'Tournaments' ? '✓ ' : ''}
            Tournaments
          </button>
        </div>

        <div className="forum-filter-actions">
          <div className="filter-group filter-group-right" role="group" aria-label="Sort options">
            <Clock className="filter-icon" size={13} strokeWidth={2.3} aria-hidden="true" />
            <button className={sortClassName('Newest')} type="button" aria-pressed={selectedSort === 'Newest'} onClick={() => handleSelectSort('Newest')}>
              {selectedSort === 'Newest' ? '✓ ' : ''}
              Newest
            </button>
            <button
              className={sortClassName('Most Replies')}
              type="button"
              aria-pressed={selectedSort === 'Most Replies'}
              onClick={() => handleSelectSort('Most Replies')}
            >
              {selectedSort === 'Most Replies' ? '✓ ' : ''}
              Most Replies
            </button>
            <button
              className={sortClassName('Most Liked')}
              type="button"
              aria-pressed={selectedSort === 'Most Liked'}
              onClick={() => handleSelectSort('Most Liked')}
            >
              {selectedSort === 'Most Liked' ? '✓ ' : ''}
              Most Liked
            </button>
          </div>

        </div>
      </section>

      <section className="forum-search-row" aria-label="Forum search">
        <SearchBar value={searchValue} onChange={handleSearchChange} />
      </section>

      {isLoading ? (
        <div className="feed-state-message">Loading posts...</div>
      ) : error ? (
        <div className="feed-state-message">Unable to load posts.</div>
      ) : visiblePosts.length === 0 ? (
        <div className="feed-state-message">No posts found.</div>
      ) : (
        <section className="forum-feed" aria-label="Forum posts">
          {visiblePosts.map((post) => (
            <ForumPost
              key={post.id}
              {...post}
              replies={post.replyCount}
              onReadMore={() => handleReadMore(post)}
              onReport={() => handleReport(post)}
            />
          ))}
        </section>
      )}

      <div className="join-feedback" aria-live="polite">
        {forumFeedback}
      </div>

      <section className="lobby-bottom-controls forum-bottom-controls" aria-label="Forum bottom controls">
        <Link className="connection-panel" to="/chat">
          Connection
        </Link>
        <nav className="pagination" aria-label="Forum pagination">
          <button className="pagination-item" type="button" onClick={goToPreviousPage} disabled={safeCurrentPage === 1}>
            &larr; Previous
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              className={`pagination-item ${safeCurrentPage === page ? 'pagination-item-active' : ''}`}
              key={page}
              type="button"
              aria-current={safeCurrentPage === page ? 'page' : undefined}
              onClick={() => selectPage(page)}
            >
              {page}
            </button>
          ))}
          <button
            className="pagination-item"
            type="button"
            onClick={goToNextPage}
            disabled={safeCurrentPage === totalPages}
          >
            Next &rarr;
          </button>
        </nav>
        <img className="corner-logo" src={logo} alt="CampusGG logo" />
      </section>
    </section>
  )
}

export default ForumFeed
