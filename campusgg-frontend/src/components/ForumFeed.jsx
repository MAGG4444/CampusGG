import { useState } from 'react'
import { Clock, Filter } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import ForumPost from './ForumPost.jsx'
import SearchBar from './SearchBar.jsx'

function ForumFeed() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedSort, setSelectedSort] = useState('Newest')
  const [searchValue, setSearchValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [forumFeedback, setForumFeedback] = useState('')

  function categoryClassName(category) {
    return `filter-chip ${selectedCategory === category ? 'filter-chip-selected' : ''}`
  }

  function sortClassName(sortOption) {
    return `filter-chip ${selectedSort === sortOption ? 'filter-chip-selected' : ''}`
  }

  function selectPage(page) {
    setCurrentPage(page)
  }

  function goToPreviousPage() {
    setCurrentPage((page) => Math.max(1, page - 1))
  }

  function goToNextPage() {
    setCurrentPage((page) => Math.min(68, page + 1))
  }

  function handleReadMore(title) {
    setForumFeedback(`Read More selected for ${title}`)
  }

  function handleReport(title) {
    setForumFeedback(`Report selected for ${title}`)
  }

  return (
    <section className="forum-page">
      <section className="forum-filter-row" aria-label="Forum filters">
        <div className="filter-group" aria-label="Category filters">
          <Filter className="filter-icon" size={13} strokeWidth={2.3} aria-hidden="true" />
          <button
            className={categoryClassName('All Categories')}
            type="button"
            onClick={() => setSelectedCategory('All Categories')}
          >
            {selectedCategory === 'All Categories' ? '✓ ' : ''}
            All Categories
          </button>
          <button
            className={categoryClassName('Strategy')}
            type="button"
            onClick={() => setSelectedCategory('Strategy')}
          >
            {selectedCategory === 'Strategy' ? '✓ ' : ''}
            Strategy
          </button>
          <button className={categoryClassName('LFG')} type="button" onClick={() => setSelectedCategory('LFG')}>
            {selectedCategory === 'LFG' ? '✓ ' : ''}
            LFG
          </button>
          <button
            className={categoryClassName('Meta Analysis')}
            type="button"
            onClick={() => setSelectedCategory('Meta Analysis')}
          >
            {selectedCategory === 'Meta Analysis' ? '✓ ' : ''}
            Meta Analysis
          </button>
          <button
            className={categoryClassName('Tournaments')}
            type="button"
            onClick={() => setSelectedCategory('Tournaments')}
          >
            {selectedCategory === 'Tournaments' ? '✓ ' : ''}
            Tournaments
          </button>
        </div>

        <div className="forum-filter-actions">
          <div className="filter-group filter-group-right" aria-label="Sort options">
            <Clock className="filter-icon" size={13} strokeWidth={2.3} aria-hidden="true" />
            <button className={sortClassName('Newest')} type="button" onClick={() => setSelectedSort('Newest')}>
              {selectedSort === 'Newest' ? '✓ ' : ''}
              Newest
            </button>
            <button
              className={sortClassName('Most Replies')}
              type="button"
              onClick={() => setSelectedSort('Most Replies')}
            >
              {selectedSort === 'Most Replies' ? '✓ ' : ''}
              Most Replies
            </button>
            <button
              className={sortClassName('Most Liked')}
              type="button"
              onClick={() => setSelectedSort('Most Liked')}
            >
              {selectedSort === 'Most Liked' ? '✓ ' : ''}
              Most Liked
            </button>
          </div>

          <button className="create-post-button" type="button" onClick={() => navigate('/create-post')}>
            + Create Post
          </button>
        </div>
      </section>

      <section className="forum-search-row" aria-label="Forum search">
        <SearchBar value={searchValue} onChange={setSearchValue} />
      </section>

      <section className="forum-feed" aria-label="Forum posts">
        <ForumPost
          title="Post Title"
          author="username"
          time="2 hours ago"
          category="Strategy"
          summary="Summary text for a strategy thread about rotations, team timing, and choosing fights around campus events."
          likes={3}
          replies={12}
          onReadMore={() => handleReadMore('Post Title')}
          onReport={() => handleReport('Post Title')}
        />
        <ForumPost
          title="Looking for a ranked trio tonight"
          author="AcePlayer"
          time="4 hours ago"
          category="LFG"
          summary="Need two teammates for evening queues. Chill comms, smart callouts, and a focus on steady improvement."
          likes={7}
          replies={9}
          onReadMore={() => handleReadMore('Looking for a ranked trio tonight')}
          onReport={() => handleReport('Looking for a ranked trio tonight')}
        />
        <ForumPost
          title="Tournament bracket prep notes"
          author="BracketBoss"
          time="1 day ago"
          category="Tournaments"
          summary="A quick checklist for scrim scheduling, map veto planning, and warming up before the next weekend bracket."
          likes={11}
          replies={18}
          onReadMore={() => handleReadMore('Tournament bracket prep notes')}
          onReport={() => handleReport('Tournament bracket prep notes')}
        />
      </section>

      <div className="join-feedback" aria-live="polite">
        {forumFeedback}
      </div>

      <section className="lobby-bottom-controls forum-bottom-controls" aria-label="Forum bottom controls">
        <Link className="connection-panel" to="/chat">
          Connection
        </Link>
        <nav className="pagination" aria-label="Forum pagination">
          <button className="pagination-item" type="button" onClick={goToPreviousPage} disabled={currentPage === 1}>
            &larr; Previous
          </button>
          <button
            className={`pagination-item ${currentPage === 1 ? 'pagination-item-active' : ''}`}
            type="button"
            onClick={() => selectPage(1)}
          >
            1
          </button>
          <button
            className={`pagination-item ${currentPage === 2 ? 'pagination-item-active' : ''}`}
            type="button"
            onClick={() => selectPage(2)}
          >
            2
          </button>
          <button
            className={`pagination-item ${currentPage === 3 ? 'pagination-item-active' : ''}`}
            type="button"
            onClick={() => selectPage(3)}
          >
            3
          </button>
          <span className="pagination-ellipsis">...</span>
          <button
            className={`pagination-item ${currentPage === 67 ? 'pagination-item-active' : ''}`}
            type="button"
            onClick={() => selectPage(67)}
          >
            67
          </button>
          <button
            className={`pagination-item ${currentPage === 68 ? 'pagination-item-active' : ''}`}
            type="button"
            onClick={() => selectPage(68)}
          >
            68
          </button>
          <button className="pagination-item" type="button" onClick={goToNextPage} disabled={currentPage === 68}>
            Next &rarr;
          </button>
        </nav>
        <img className="corner-logo" src={logo} alt="CampusGG logo" />
      </section>
    </section>
  )
}

export default ForumFeed
