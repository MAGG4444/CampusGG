
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import { useJoinedLobbies } from '../context/useJoinedLobbies.js'
import GameFilter from './GameFilter.jsx'
import HomepageToggle from './HomepageToggle.jsx'
import LobbyCard from './LobbyCard.jsx'
import Pagination from './Pagination.jsx'
import SearchBar from './SearchBar.jsx'
import SkillFilter from './SkillFilter.jsx'
import { useAuth } from '../context/useAuth.js'
import { filterLobbyFeed, lobbyFeedPage, startLobbyFeedSync } from '../utils/lobbyFeedSync.js'
import { attemptLobbyJoin, currentLobbyFromFeed } from '../utils/currentLobby.js'
import CurrentLobbyDialog from './CurrentLobbyDialog.jsx'
import CurrentLobbySection from './CurrentLobbySection.jsx'

const LOBBIES_PER_PAGE = 6
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function LobbyFeed() {
  const navigate = useNavigate()
  const { joinedLobbyIds, isLobbyJoined, getLobbyRole, joinLobby, refreshMemberships } = useJoinedLobbies()

  // Real lobby data from PostgreSQL
  const [lobbies, setLobbies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Existing frontend UI state
  const [selectedGame, setSelectedGame] = useState('All Games')
  const [selectedSkill, setSelectedSkill] = useState('Most Popular')
  const [searchValue, setSearchValue] = useState('')
  const [isHomepage, setIsHomepage] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const { isAuthenticated, token } = useAuth()
  const [joinError, setJoinError] = useState('')
  const [joiningLobbyId, setJoiningLobbyId] = useState(null)
  const joinRequestRef = useRef(null)
  useEffect(() => () => joinRequestRef.current?.abort(), [])
  const [conflictLobby, setConflictLobby] = useState(null)
  const currentLobby = currentLobbyFromFeed(joinedLobbyIds, getLobbyRole, lobbies)

  // ============================================================
  // FETCH LOBBIES FROM POSTGRESQL
  // ============================================================

  useEffect(() => {
    async function fetchLobbies(signal) {
      try {
        const [feedResult, membershipResult] = await Promise.allSettled([
          fetch(`${API_URL}/lobbies/db`, { signal }),
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
        const formattedLobbies = data.map((lobby) => ({
          ...lobby,
          userName: lobby.host?.username ?? 'Unknown host',
        }))

        if (signal.aborted) return
        setLobbies((current) => JSON.stringify(current) === JSON.stringify(formattedLobbies) ? current : formattedLobbies)
        setError(membershipResult.status === 'rejected' ? 'Unable to refresh lobby membership.' : null)
      } catch (err) {
        if (signal.aborted) {
          return
        }

        console.error('Failed to fetch lobbies:', err)
        setError('Unable to load lobbies from the server.')
      } finally {
        if (!signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    return startLobbyFeedSync({ load: fetchLobbies, onError: () => {}, document, window })
  }, [token, refreshMemberships])

  // ============================================================
  // FILTER LOBBIES
  // ============================================================

  const filteredLobbies = useMemo(() => {
    return filterLobbyFeed(lobbies, searchValue, selectedGame, selectedSkill)
  }, [lobbies, searchValue, selectedGame, selectedSkill])

  // Backend currently returns newest lobbies first.
  // Popularity ranking is not implemented in PostgreSQL yet.

  // ============================================================
  // PAGINATION
  // ============================================================

  const { page: safePage, totalPages, items: visibleLobbies } =
    lobbyFeedPage(filteredLobbies, currentPage, LOBBIES_PER_PAGE)

  // ============================================================
  // LOBBY ACTIONS
  // Existing local join behavior is temporary.
  // Backend joining will be connected in the next step.
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
      setJoinError(
        error instanceof Error
          ? error.message
          : 'Unable to join lobby.',
      )
    } finally {
      if (joinRequestRef.current === controller) joinRequestRef.current = null
      if (!controller.signal.aborted) setJoiningLobbyId(null)
    }
  }


  function handleSelectGame(game) {
    setSelectedGame(game)
    setCurrentPage(1)
  }

  function handleSelectSkill(skill) {
    setSelectedSkill(skill)
    setCurrentPage(1)
  }

  function handleSearchChange(value) {
    setSearchValue(value)
    setCurrentPage(1)
  }

  // ============================================================
  // RENDER EXISTING CAMPUSGG UI
  // ============================================================

  return (
    <section className="lobby-page page-enter">
      <header className="page-heading">
        <div>
          <p className="page-kicker">Squad finder</p>

          <h1>Discover your next lobby</h1>

          <p>
            Filter by game and skill level, then jump into a
            session that fits how you want to play.
          </p>
        </div>

        <button
          className="create-lobby-button"
          type="button"
          onClick={() => navigate('/create-lobby')}
        >
          + Create Lobby
        </button>
      </header>

      <CurrentLobbySection lobby={currentLobby} onOpen={(id) => navigate(`/lobby/${id}`)} />

      <section
        className="filter-row"
        aria-label="Lobby filters"
      >
        <GameFilter
          selectedGame={selectedGame}
          onSelectGame={handleSelectGame}
        />

        <SkillFilter
          selectedSkill={selectedSkill}
          onSelectSkill={handleSelectSkill}
        />
      </section>

      <section className="search-row">
        <SearchBar
          value={searchValue}
          onChange={handleSearchChange}
        />

        <div className="action-stack">
          <HomepageToggle
            isOn={isHomepage}
            onToggle={() =>
              setIsHomepage((current) => !current)
            }
          />
        </div>
      </section>
      
      {joinError ? (
        <div className="feed-state-message" role="alert">
          {joinError}
        </div>
      ) : null}

      {error && lobbies.length > 0 ? <div className="feed-state-message" role="alert">{error}</div> : null}
      {isLoading ? (
        <div className="feed-state-message">
          Loading lobbies...
        </div>
      ) : error && lobbies.length === 0 ? (
        <div className="feed-state-message" role="alert">
          {error}
        </div>
      ) : visibleLobbies.length === 0 ? (
        <div className="feed-state-message">
          No lobbies found.
        </div>
      ) : (
        <section className="lobby-grid">
          {visibleLobbies.map((lobby) => (
            <LobbyCard
              key={lobby.id}
              lobbyName={lobby.lobbyName}
              userName={lobby.userName}
              details={lobby.details}
              isJoined={isLobbyJoined(lobby.id)}
              role={getLobbyRole(lobby.id)}
              onJoin={() => handleJoin(lobby)}
            />
          ))}
        </section>
      )}

      <section
        className="lobby-bottom-controls"
        aria-label="Lobby bottom controls"
      >
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onSelectPage={setCurrentPage}
        />

        <img
          className="corner-logo"
          src={logo}
          alt="CampusGG logo"
        />
      </section>
      {conflictLobby && <CurrentLobbyDialog lobby={conflictLobby} onCancel={() => setConflictLobby(null)}
        onView={(id) => { setConflictLobby(null); navigate(`/lobby/${id}`) }} />}
    </section>
  )
}

export default LobbyFeed
