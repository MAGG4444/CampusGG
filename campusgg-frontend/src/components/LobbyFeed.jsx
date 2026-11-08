
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Gamepad2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useJoinedLobbies } from '../context/useJoinedLobbies.js'
import LobbyFilters, { ActiveLobbyFilters } from './LobbyFilters.jsx'
import LobbyCard from './LobbyCard.jsx'
import SearchBar from './SearchBar.jsx'
import { useAuth } from '../context/useAuth.js'
import { filterLobbyFeed, startLobbyFeedSync } from '../utils/lobbyFeedSync.js'
import { attemptLobbyJoin, currentLobbyFromFeed } from '../utils/currentLobby.js'
import CurrentLobbyDialog from './CurrentLobbyDialog.jsx'

const LOBBY_BATCH_SIZE = 6
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function LobbyFeed() {
  const navigate = useNavigate()
  const { joinedLobbyIds, isLobbyJoined, getLobbyRole, joinLobby, refreshMemberships } = useJoinedLobbies()

  // Real lobby data from PostgreSQL
  const [lobbies, setLobbies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasFeedData, setHasFeedData] = useState(false)
  const [error, setError] = useState(null)

  // Existing frontend UI state
  const [selectedGame, setSelectedGame] = useState('All Games')
  const [selectedSkill, setSelectedSkill] = useState('Any Skill')
  const [capacity, setCapacity] = useState('any')
  const [visibility, setVisibility] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [visibleCount, setVisibleCount] = useState(LOBBY_BATCH_SIZE)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef = useRef(null)
  const toolbarRef = useRef(null)
  const resultsRef = useRef(null)
  const sentinelRef = useRef(null)
  const loadingMoreRef = useRef(false)
  const revealTimerRef = useRef(null)

  const { isAuthenticated, token } = useAuth()
  const [joinError, setJoinError] = useState('')
  const [joiningLobbyId, setJoiningLobbyId] = useState(null)
  const joinRequestRef = useRef(null)
  const syncRef = useRef(null)
  useEffect(() => () => joinRequestRef.current?.abort(), [])
  const [conflictLobby, setConflictLobby] = useState(null)
  const [joinedCard, setJoinedCard] = useState(null)
  const [cardVisibility, setCardVisibility] = useState(null)
  const currentLobby = currentLobbyFromFeed(joinedLobbyIds, getLobbyRole, lobbies)
  const currentId = currentLobby ? String(currentLobby.id) : null

  // ============================================================
  // FETCH LOBBIES FROM POSTGRESQL
  // ============================================================

  useEffect(() => {
    async function fetchLobbies(signal) {
      try {
        const [feedResult, membershipResult] = await Promise.allSettled([
          fetch(`${API_URL}/lobbies/db`, { signal, headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          token ? refreshMemberships(signal) : Promise.resolve(),
        ])
        if (feedResult.status === 'rejected') throw feedResult.reason
        const response = feedResult.value

        if (!response.ok) {
          throw new Error('Unable to load lobbies')
        }

        const data = await response.json()

        if (!Array.isArray(data)) {
          throw new Error('Invalid lobby data received')
        }

        // Adapt backend records to the existing LobbyCard props.
        const seen = new Set()
        const formattedLobbies = data.filter(lobby => {
          if (seen.has(lobby.id)) return false
          seen.add(lobby.id)
          return true
        }).map((lobby) => ({ ...lobby, userName: lobby.host?.username ?? 'Unknown host' }))

        if (signal.aborted) return
        setLobbies((current) => JSON.stringify(current) === JSON.stringify(formattedLobbies) ? current : formattedLobbies)
        setHasFeedData(true)
        setError(membershipResult.status === 'rejected' ? 'Unable to refresh lobby membership.' : null)
      } catch {
        if (signal.aborted) {
          return
        }

        setError('Unable to load lobbies from the server.')
      } finally {
        if (!signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    const stop = startLobbyFeedSync({ load: fetchLobbies, onError: () => {}, document, window })
    syncRef.current = stop
    return () => { syncRef.current = null; stop() }
  }, [token, refreshMemberships])

  // ============================================================
  // FILTER LOBBIES
  // ============================================================

  const filteredLobbies = useMemo(() => {
    const matches = filterLobbyFeed(
      lobbies.filter(lobby => lobby.visibility === 'public' || isLobbyJoined(lobby.id)),
      searchValue, selectedGame, selectedSkill, capacity, visibility,
    )
    const unrestricted = !searchValue.trim() && selectedGame === 'All Games' && selectedSkill === 'Any Skill' && capacity === 'any' && visibility === 'all'
    if (!unrestricted || !currentId) return matches
    const index = matches.findIndex(lobby => String(lobby.id) === currentId)
    return index > 0 ? [matches[index], ...matches.slice(0, index), ...matches.slice(index + 1)] : matches
  }, [lobbies, searchValue, selectedGame, selectedSkill, capacity, visibility, isLobbyJoined, currentId])

  const visibleLobbies = filteredLobbies.slice(0, visibleCount)
  const hasMore = visibleCount < filteredLobbies.length
  const filterKey = JSON.stringify([searchValue, selectedGame, selectedSkill, capacity, visibility])
  const joinedRendered = Boolean(currentId && visibleLobbies.some(lobby => String(lobby.id) === currentId))

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    const page = pageRef.current
    if (!toolbar || !page) return undefined
    const update = () => page.style.setProperty('--lobby-toolbar-height', `${toolbar.getBoundingClientRect().height}px`)
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(toolbar)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  useEffect(() => {
    if (!joinedCard || !currentId || !joinedRendered || typeof IntersectionObserver === 'undefined') return undefined
    let observer
    let active = true
    const observe = () => {
      observer?.disconnect()
      const top = Math.max(0, Math.ceil(toolbarRef.current?.getBoundingClientRect().bottom ?? 0))
      observer = new IntersectionObserver(entries => {
        if (!active) return
        const entry = entries.find(item => item.target === joinedCard)
        if (entry) setCardVisibility({ id: currentId, card: joinedCard, filterKey, visible: entry.isIntersecting && entry.intersectionRatio >= 0.98 })
      }, { root: null, rootMargin: `-${top}px 0px 0px 0px`, threshold: [0, 0.98, 1] })
      observer.observe(joinedCard)
    }
    observe()
    window.addEventListener('resize', observe)
    return () => { active = false; observer?.disconnect(); window.removeEventListener('resize', observe) }
  }, [joinedCard, currentId, joinedRendered, filterKey])

  const showMyLobby = Boolean(currentId && (!joinedRendered || typeof IntersectionObserver === 'undefined' || (cardVisibility?.id === currentId && cardVisibility.card === joinedCard && cardVisibility.filterKey === filterKey && !cardVisibility.visible)))

  useEffect(() => {
    if (!hasMore || !sentinelRef.current || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null
        loadingMoreRef.current = false
        setVisibleCount(count => count + LOBBY_BATCH_SIZE)
        setLoadingMore(false)
      }, 120)
    }, { root: null, rootMargin: '300px 0px' })
    observer.observe(sentinelRef.current)
    return () => {
      observer.disconnect()
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
      loadingMoreRef.current = false
    }
  }, [hasMore, visibleCount, filterKey])

  function resetResults() {
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current)
    revealTimerRef.current = null
    loadingMoreRef.current = false
    setLoadingMore(false)
    setVisibleCount(LOBBY_BATCH_SIZE)
    const results = resultsRef.current
    const toolbar = toolbarRef.current
    if (results && toolbar && results.getBoundingClientRect().top < toolbar.getBoundingClientRect().bottom) {
      results.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
  }

  // ============================================================
  // LOBBY ACTIONS
  // ============================================================

  
  async function handleJoin(lobby) {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    if (isLobbyJoined(lobby.id)) {
      navigate(`/lobby/${lobby.id}`)
      return
    }

    if (joiningLobbyId || joinRequestRef.current) {
      return
    }

    setJoiningLobbyId(lobby.id)
    setJoinError('')
    const controller = new AbortController()
    joinRequestRef.current = controller

    try {
      const { current } = await attemptLobbyJoin({ lobby, lobbies, refreshMemberships, joinLobby, signal: controller.signal })
      if (controller.signal.aborted) return
      if (current) {
        if (String(current.id) === String(lobby.id)) navigate(`/lobby/${current.id}`)
        else setConflictLobby(current)
        return
      }
      navigate(`/lobby/${lobby.id}`)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error?.status === 404 || error?.status === 409) syncRef.current?.refresh()
      setJoinError(
        error?.status === 404 ? 'This lobby is no longer available.' : error instanceof Error
          ? error.message
          : 'Unable to join lobby.',
      )
    } finally {
      if (joinRequestRef.current === controller) joinRequestRef.current = null
      if (!controller.signal.aborted) setJoiningLobbyId(null)
    }
  }


  function handleFilterChange(key, value) {
    const setters = { game: setSelectedGame, skill: setSelectedSkill, capacity: setCapacity, visibility: setVisibility }
    setters[key](value)
    resetResults()
  }

  function clearFilters() {
    setSelectedGame('All Games')
    setSelectedSkill('Any Skill')
    setCapacity('any')
    setVisibility('all')
    resetResults()
  }
  function handleSearchChange(value) {
    setSearchValue(value)
    resetResults()
  }
  const hasConstraints = Boolean(searchValue.trim()) || selectedGame !== 'All Games' || selectedSkill !== 'Any Skill' || capacity !== 'any' || visibility !== 'all'
  function clearAllConstraints() {
    setSearchValue('')
    clearFilters()
  }

  // ============================================================
  // RENDER EXISTING CAMPUSGG UI
  // ============================================================

  return (
    <section className="lobby-page" ref={pageRef}>
      <div className="lobby-toolbar" ref={toolbarRef} aria-label="Lobby browsing controls">
        <button type="button" className="lobby-filters-toggle" aria-controls="lobby-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>
          Filters
        </button>
        <SearchBar value={searchValue} onChange={handleSearchChange} />
        <button
          className="create-lobby-button"
          type="button"
          onClick={() => navigate('/create-lobby')}
        >
          + Create Lobby
        </button>
      </div>
      <div className={`lobby-feed-layout ${filtersOpen ? 'filters-open' : ''}`}>
      <div className="lobby-filters-column">
        <LobbyFilters open={filtersOpen} game={selectedGame} skill={selectedSkill} capacity={capacity} visibility={visibility} availableGames={lobbies.filter(lobby => lobby.visibility === 'public' || isLobbyJoined(lobby.id)).map(lobby => lobby.game)} onChange={handleFilterChange} />
      </div>
      <div className="lobby-feed-content">
      <div ref={resultsRef} className="lobby-results-anchor" />
      <ActiveLobbyFilters game={selectedGame} skill={selectedSkill} capacity={capacity} visibility={visibility} onChange={handleFilterChange} onClear={clearFilters} />
      
      {joinError ? (
        <div className="lobby-join-error" role="alert">
          {joinError}
        </div>
      ) : null}

      {error && hasFeedData ? <div className="lobby-sync-error" role="status">{error} <button type="button" onClick={() => syncRef.current?.refresh()}>Retry</button></div> : null}
      {isLoading ? (
        <div className="lobby-grid lobby-skeleton-grid" role="status" aria-label="Loading lobbies">
          {[0, 1, 2, 3].map(index => <div className="lobby-skeleton" aria-hidden="true" key={index}><span /><span /><span /></div>)}
        </div>
      ) : error && !hasFeedData ? (
        <div className="lobby-empty-state" role="alert">
          <h2>Unable to load lobbies</h2><p>Please check your connection and try again.</p>
          <button type="button" className="lobby-empty-secondary" onClick={() => syncRef.current?.refresh()}>Retry</button>
        </div>
      ) : visibleLobbies.length === 0 ? (
        <div className="lobby-empty-state">
          <h2>{hasConstraints ? 'No matching lobbies' : 'No lobbies yet'}</h2>
          <p>{hasConstraints ? 'Try adjusting your search or filters.' : 'Be the first to create one.'}</p>
          <div className="lobby-empty-actions">
            {hasConstraints && <button type="button" className="lobby-empty-secondary" onClick={clearAllConstraints}>Clear Filters</button>}
            <button type="button" className="create-lobby-button" onClick={() => navigate('/create-lobby')}>Create Lobby</button>
          </div>
        </div>
      ) : (
        <section className="lobby-grid">
          {visibleLobbies.map((lobby) => (
            <LobbyCard
              key={lobby.id}
              lobbyName={lobby.lobbyName}
              userName={lobby.userName}
              details={lobby.details}
              game={lobby.game}
              skillLevel={lobby.skillLevel}
              memberCount={lobby.memberCount}
              participantLimit={lobby.participantLimit}
              visibility={lobby.visibility}
              isJoined={isLobbyJoined(lobby.id)}
              cardRef={String(lobby.id) === currentId ? setJoinedCard : undefined}
              isJoining={String(joiningLobbyId) === String(lobby.id)}
              onJoin={() => handleJoin(lobby)}
            />
          ))}
        </section>
      )}

      {!isLoading && !(!hasFeedData && error) && filteredLobbies.length > 0 && (hasMore
        ? <div ref={sentinelRef} className="lobby-list-status" role="status">{loadingMore ? <><span className="lobby-spinner" aria-hidden="true" />Loading more lobbies…</> : 'More lobbies below'}
            {typeof IntersectionObserver === 'undefined' && <button type="button" onClick={() => setVisibleCount(count => count + LOBBY_BATCH_SIZE)}>Load more</button>}
          </div>
        : <p className="lobby-list-status">You’ve reached the end.</p>)}
      </div>
      </div>
      {currentId && <button type="button" className={`my-lobby-shortcut${showMyLobby ? ' is-visible' : ''}`} aria-label="Open My Lobby" aria-hidden={!showMyLobby} inert={!showMyLobby} tabIndex={showMyLobby ? 0 : -1} onClick={() => navigate(`/lobby/${currentId}`)}>
        <Gamepad2 size={17} aria-hidden="true" /> My Lobby <ArrowUpRight size={15} aria-hidden="true" />
      </button>}
      {conflictLobby && <CurrentLobbyDialog lobby={conflictLobby} onCancel={() => setConflictLobby(null)}
        onView={(id) => { setConflictLobby(null); navigate(`/lobby/${id}`) }} />}
    </section>
  )
}

export default LobbyFeed
