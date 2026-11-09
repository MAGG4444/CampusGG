
import { useEffect, useMemo, useState } from 'react'
import { Clock, Filter } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import logo from '../assets/LOGO.png'
import ForumPost from './ForumPost.jsx'
import SearchBar from './SearchBar.jsx'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000'

const POSTS_PER_PAGE = 3
const API_BATCH_SIZE = 50

// ============================================================
// FETCH POSTS FROM THE CAMPUSGG BACKEND
// ============================================================

async function fetchForumPosts(signal) {
  const allPosts = []
  let page = 1

  while (true) {
    const response = await fetch(
      `${API_URL}/forum/posts?page=${page}&limit=${API_BATCH_SIZE}`,
      { signal },
    )

    if (!response.ok) {
      throw new Error('Unable to load Forum posts')
    }

    const data = await response.json()

    if (!Array.isArray(data.posts)) {
      throw new Error('Invalid Forum response')
    }

    allPosts.push(...data.posts)

    const total = Number(data.total)

    if (
      data.posts.length === 0 ||
      data.posts.length < API_BATCH_SIZE ||
      (Number.isFinite(total) && allPosts.length >= total)
    ) {
      break
    }

    page += 1
  }

  return allPosts
}

// ============================================================
// FETCH COMMENT COUNTS
// ============================================================

async function fetchReplyCount(postId, signal) {
  try {
    const response = await fetch(
      `${API_URL}/forum/posts/${encodeURIComponent(postId)}/comments?page=1&limit=1`,
      { signal },
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const total = Number(data.total)

    return Number.isFinite(total) ? total : null
  } catch (error) {
    if (signal.aborted) {
      throw error
    }

    return null
  }
}

// ============================================================
// CONVERT DATABASE POSTS INTO FRONTEND POST OBJECTS
// ============================================================

function normalizePost(post, replyCount) {
  return {
    id: post.id,
    title: post.title,

    author:
      post.author?.displayName ||
      post.author?.username ||
      'Unknown User',

    time: post.createdAt
      ? new Date(post.createdAt).toLocaleString()
      : 'Unknown time',

    // Our backend currently stores game rather than
    // Strategy/LFG-style categories.
    category: post.category || post.game || 'General',
    filterCategory: post.category || null,

    summary: post.content || '',

    likes: Number(post.likeCount) || 0,
    replyCount: replyCount ?? '—',

    createdAt: post.createdAt,
  }
}

// ============================================================
// MAIN FORUM FEED
// ============================================================

function ForumFeed() {
  const navigate = useNavigate()

  // Existing Forum controls
  const [selectedCategory, setSelectedCategory] =
    useState('All Categories')

  const [selectedSort, setSelectedSort] =
    useState('Newest')

  const [searchValue, setSearchValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [forumFeedback, setForumFeedback] = useState('')

  // Backend state
  const [forumPosts, setForumPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // ==========================================================
  // LOAD REAL POSTS FROM POSTGRESQL
  // ==========================================================

  useEffect(() => {
    const controller = new AbortController()

    async function loadForumPosts() {
      setIsLoading(true)
      setError(null)

      try {
        const posts = await fetchForumPosts(controller.signal)
        const loadedPosts = []

        // Load comment counts in small batches.
        for (let index = 0; index < posts.length; index += 6) {
          const batch = posts.slice(index, index + 6)

          const results = await Promise.all(
            batch.map(async (post) => {
              const replyCount = await fetchReplyCount(
                post.id,
                controller.signal,
              )

              return normalizePost(post, replyCount)
            }),
          )

          loadedPosts.push(...results)
        }

        if (!controller.signal.aborted) {
          setForumPosts(loadedPosts)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message || 'Unable to load Forum posts',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadForumPosts()

    return () => controller.abort()
  }, [])

  // ==========================================================
  // SEARCH AND SORT
  // ==========================================================

  const filteredPosts = useMemo(() => {
    const normalizedSearch =
      searchValue.trim().toLowerCase()

    const matchingPosts = forumPosts.filter((post) => {
      const matchesCategory =
        selectedCategory === 'All Categories' ||
        post.filterCategory === selectedCategory

      const searchableText = `
        ${post.title}
        ${post.author}
        ${post.summary}
        ${post.category}
      `.toLowerCase()

      const matchesSearch =
        normalizedSearch === '' ||
        searchableText.includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })

    return [...matchingPosts].sort(
      (firstPost, secondPost) => {
        if (selectedSort === 'Most Replies') {
          return (
            (Number(secondPost.replyCount) || 0) -
            (Number(firstPost.replyCount) || 0)
          )
        }

        if (selectedSort === 'Most Liked') {
          return secondPost.likes - firstPost.likes
        }

        return (
          new Date(secondPost.createdAt) -
          new Date(firstPost.createdAt)
        )
      },
    )
  }, [
    forumPosts,
    searchValue,
    selectedCategory,
    selectedSort,
  ])

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPosts.length / POSTS_PER_PAGE),
  )

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages,
  )

  const firstPostIndex =
    (safeCurrentPage - 1) * POSTS_PER_PAGE

  const visiblePosts = filteredPosts.slice(
    firstPostIndex,
    firstPostIndex + POSTS_PER_PAGE,
  )

  function selectPage(page) {
    setCurrentPage(
      Math.min(Math.max(1, page), totalPages),
    )
  }

  function goToPreviousPage() {
    setCurrentPage((page) =>
      Math.max(1, page - 1),
    )
  }

  function goToNextPage() {
    setCurrentPage((page) =>
      Math.min(totalPages, page + 1),
    )
  }

  // ==========================================================
  // FILTER AND SORT BUTTONS
  // ==========================================================

  function categoryClassName(category) {
    return `filter-chip ${
      selectedCategory === category
        ? 'filter-chip-selected'
        : ''
    }`
  }

  function sortClassName(sortOption) {
    return `filter-chip ${
      selectedSort === sortOption
        ? 'filter-chip-selected'
        : ''
    }`
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

  // ==========================================================
  // POST ACTIONS
  // ==========================================================

  function handleReadMore(post) {
    navigate(`/forum/${post.id}`)
  }

  function handleReport(post) {
    setForumFeedback(
      `Reporting is not connected to the backend yet. No report was submitted for ${post.title}.`,
    )
  }

  const categories = [
    'All Categories',
    'Strategy',
    'LFG',
    'Meta Analysis',
    'Tournaments',
  ]

  const sortOptions = [
    'Newest',
    'Most Replies',
    'Most Liked',
  ]

  // ==========================================================
  // RENDER FORUM PAGE
  // ==========================================================

  return (
    <section className="forum-page page-enter">

      {/* Page heading */}
      <header className="page-heading">
        <div>
          <p className="page-kicker">
            Campus conversations
          </p>

          <h1>Forum</h1>

          <p>
            Share strategies, find teammates, and keep up
            with the conversations shaping campus play.
          </p>
        </div>

        <button
          className="create-post-button"
          type="button"
          onClick={() => navigate('/create-post')}
        >
          + Create Post
        </button>
      </header>

      {/* Category filters and sorting */}
      <section
        className="forum-filter-row"
        aria-label="Forum filters"
      >
        <div
          className="filter-group"
          role="group"
          aria-label="Category filters"
        >
          <Filter
            className="filter-icon"
            size={13}
            strokeWidth={2.3}
            aria-hidden="true"
          />

          {categories.map((category) => (
            <button
              key={category}
              className={categoryClassName(category)}
              type="button"
              aria-pressed={
                selectedCategory === category
              }
              onClick={() =>
                handleSelectCategory(category)
              }
            >
              {selectedCategory === category
                ? '✓ '
                : ''}

              {category}
            </button>
          ))}
        </div>

        <div className="forum-filter-actions">
          <div
            className="filter-group filter-group-right"
            role="group"
            aria-label="Sort options"
          >
            <Clock
              className="filter-icon"
              size={13}
              strokeWidth={2.3}
              aria-hidden="true"
            />

            {sortOptions.map((sortOption) => (
              <button
                key={sortOption}
                className={sortClassName(sortOption)}
                type="button"
                aria-pressed={
                  selectedSort === sortOption
                }
                onClick={() =>
                  handleSelectSort(sortOption)
                }
              >
                {selectedSort === sortOption
                  ? '✓ '
                  : ''}

                {sortOption}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Search */}
      <section
        className="forum-search-row"
        aria-label="Forum search"
      >
        <SearchBar
          value={searchValue}
          onChange={handleSearchChange}
        />
      </section>

      {/* Live PostgreSQL Forum posts */}
      {isLoading ? (
        <div className="feed-state-message">
          Loading posts...
        </div>
      ) : error ? (
        <div
          className="feed-state-message"
          role="alert"
        >
          {error}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="feed-state-message">
          {selectedCategory !== 'All Categories' &&
          !forumPosts.some(
            (post) => post.filterCategory !== null,
          )
            ? 'Category filtering requires backend category support. Select All Categories to view posts.'
            : 'No posts found.'}
        </div>
      ) : (
        <section
          className="forum-feed"
          aria-label="Forum posts"
        >
          {visiblePosts.map((post) => (
            <ForumPost
              key={post.id}
              {...post}
              replies={post.replyCount}
              onReadMore={() =>
                handleReadMore(post)
              }
              onReport={() =>
                handleReport(post)
              }
            />
          ))}
        </section>
      )}

      {/* Report feedback */}
      <div
        className="join-feedback"
        aria-live="polite"
      >
        {forumFeedback}
      </div>

      {/* Bottom controls */}
      <section
        className="lobby-bottom-controls forum-bottom-controls"
        aria-label="Forum bottom controls"
      >
        <Link
          className="connection-panel"
          to="/chat"
        >
          Connection
        </Link>

        <nav
          className="pagination"
          aria-label="Forum pagination"
        >
          <button
            className="pagination-item"
            type="button"
            onClick={goToPreviousPage}
            disabled={safeCurrentPage === 1}
          >
            &larr; Previous
          </button>

          {Array.from(
            { length: totalPages },
            (_, index) => index + 1,
          ).map((page) => (
            <button
              key={page}
              className={`pagination-item ${
                safeCurrentPage === page
                  ? 'pagination-item-active'
                  : ''
              }`}
              type="button"
              aria-current={
                safeCurrentPage === page
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                selectPage(page)
              }
            >
              {page}
            </button>
          ))}

          <button
            className="pagination-item"
            type="button"
            onClick={goToNextPage}
            disabled={
              safeCurrentPage === totalPages
            }
          >
            Next &rarr;
          </button>
        </nav>

        <img
          className="corner-logo"
          src={logo}
          alt="CampusGG logo"
        />
      </section>
    </section>
  )
}

export default ForumFeed
