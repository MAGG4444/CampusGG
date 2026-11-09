
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import { useJoinedLobbies } from '../context/useJoinedLobbies.js'
import GameFilter from './GameFilter.jsx'
import HomepageToggle from './HomepageToggle.jsx'
import LobbyCard from './LobbyCard.jsx'
import Pagination from './Pagination.jsx'
import SearchBar from './SearchBar.jsx'
import SkillFilter from './SkillFilter.jsx'
import { useAuth } from '../context/useAuth.js'

const LOBBIES_PER_PAGE = 6
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function LobbyFeed() {
  const navigate = useNavigate()
  const { isLobbyJoined, joinLobby } = useJoinedLobbies()

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

  const { isAuthenticated } = useAuth()
  const [joinError, setJoinError] = useState('')
  const [joiningLobbyId, setJoiningLobbyId] = useState(null)

  // ============================================================
  // FETCH LOBBIES FROM POSTGRESQL
  // ============================================================

  useEffect(() => {
    const controller = new AbortController()

    async function fetchLobbies() {
      try {
        const response = await fetch(`${API_URL}/lobbies/db`, {
          signal: controller.signal,
        })

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

        setLobbies(formattedLobbies)
        setError(null)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }

        console.error('Failed to fetch lobbies:', err)
        setError('Unable to load lobbies from the server.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchLobbies()

    return () => controller.abort()
  }, [])

  // ============================================================
  // FILTER LOBBIES
  // ============================================================

  const filteredLobbies = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return lobbies.filter((lobby) => {
      const matchesGame =
        selectedGame === 'All Games' ||
        lobby.game === selectedGame

      const matchesSkill =
        selectedSkill === 'Most Popular' ||
        lobby.skillLevel === selectedSkill

      const searchableText = `
        ${lobby.lobbyName ?? ''}
        ${lobby.userName ?? ''}
        ${lobby.details ?? ''}
      `.toLowerCase()

      const matchesSearch =
        normalizedSearch === '' ||
        searchableText.includes(normalizedSearch)

      return matchesGame && matchesSkill && matchesSearch
    })
  }, [lobbies, searchValue, selectedGame, selectedSkill])

  // Backend currently returns newest lobbies first.
  // Popularity ranking is not implemented in PostgreSQL yet.

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLobbies.length / LOBBIES_PER_PAGE),
  )

  const firstLobbyIndex =
    (currentPage - 1) * LOBBIES_PER_PAGE

  const visibleLobbies = filteredLobbies.slice(
    firstLobbyIndex,
    firstLobbyIndex + LOBBIES_PER_PAGE,
  )

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

    if (joiningLobbyId) {
      return
    }

    setJoiningLobbyId(lobby.id)
    setJoinError('')

    try {
      await joinLobby(lobby.id)
      navigate(`/lobby/${lobby.id}`)
    } catch (error) {
      if (error.status === 409) {
        // Could already be a member, or the lobby could be full.
        // Open details to retrieve the authoritative member list.
        navigate(`/lobby/${lobby.id}`)
        return
      }

      setJoinError(
        error instanceof Error
          ? error.message
          : 'Unable to join lobby.',
      )
    } finally {
      setJoiningLobbyId(null)
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

      {isLoading ? (
        <div className="feed-state-message">
          Loading lobbies...
        </div>
      ) : error ? (
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
              onJoin={() => handleJoin(lobby)}
            />
          ))}
        </section>
      )}

      <section
        className="lobby-bottom-controls"
        aria-label="Lobby bottom controls"
      >
        <Link className="connection-panel" to="/chat">
          Connection
        </Link>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onSelectPage={setCurrentPage}
        />

        <img
          className="corner-logo"
          src={logo}
          alt="CampusGG logo"
        />
      </section>
    </section>
  )
}

export default LobbyFeed
