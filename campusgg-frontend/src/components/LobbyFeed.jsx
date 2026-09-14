import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import { lobbies } from '../data/lobbies.js'
import GameFilter from './GameFilter.jsx'
import HomepageToggle from './HomepageToggle.jsx'
import LobbyCard from './LobbyCard.jsx'
import Pagination from './Pagination.jsx'
import SearchBar from './SearchBar.jsx'
import SkillFilter from './SkillFilter.jsx'

const LOBBIES_PER_PAGE = 6

function LobbyFeed() {
  const navigate = useNavigate()
  const [selectedGame, setSelectedGame] = useState('All Games')
  const [selectedSkill, setSelectedSkill] = useState('Most Popular')
  const [searchValue, setSearchValue] = useState('')
  const [isHomepage, setIsHomepage] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [joinFeedback, setJoinFeedback] = useState('')
  const [isLoading] = useState(false)
  const [error] = useState(null)

  const filteredLobbies = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    const matchingLobbies = lobbies.filter((lobby) => {
      const matchesGame = selectedGame === 'All Games' || lobby.game === selectedGame
      const matchesSkill = selectedSkill === 'Most Popular' || lobby.skillLevel === selectedSkill
      const searchableText = `${lobby.lobbyName} ${lobby.userName} ${lobby.details}`.toLowerCase()
      const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch)

      return matchesGame && matchesSkill && matchesSearch
    })

    if (selectedSkill === 'Most Popular') {
      return [...matchingLobbies].sort((firstLobby, secondLobby) => secondLobby.popularity - firstLobby.popularity)
    }

    return matchingLobbies
  }, [searchValue, selectedGame, selectedSkill])

  const totalPages = Math.max(1, Math.ceil(filteredLobbies.length / LOBBIES_PER_PAGE))
  const firstLobbyIndex = (currentPage - 1) * LOBBIES_PER_PAGE
  const visibleLobbies = filteredLobbies.slice(firstLobbyIndex, firstLobbyIndex + LOBBIES_PER_PAGE)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchValue, selectedGame, selectedSkill])

  function handleJoin(lobby) {
    setJoinFeedback(`Selected ${lobby.lobbyName}`)
  }

  return (
    <section className="lobby-page">
      <section className="filter-row" aria-label="Lobby filters">
        <GameFilter selectedGame={selectedGame} onSelectGame={setSelectedGame} />
        <SkillFilter selectedSkill={selectedSkill} onSelectSkill={setSelectedSkill} />
      </section>

      <section className="search-row">
        <SearchBar value={searchValue} onChange={setSearchValue} />
        <div className="action-stack">
          <HomepageToggle isOn={isHomepage} onToggle={() => setIsHomepage((current) => !current)} />
          <button className="create-lobby-button" type="button" onClick={() => navigate('/create-lobby')}>
            + Create Lobby
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="feed-state-message">Loading lobbies...</div>
      ) : error ? (
        <div className="feed-state-message">Unable to load lobbies.</div>
      ) : visibleLobbies.length === 0 ? (
        <div className="feed-state-message">No lobbies found.</div>
      ) : (
        <section className="lobby-grid">
          {visibleLobbies.map((lobby) => (
            <LobbyCard
              details={lobby.details}
              key={lobby.id}
              lobbyName={lobby.lobbyName}
              onJoin={() => handleJoin(lobby)}
              userName={lobby.userName}
            />
          ))}
        </section>
      )}

      <div className="join-feedback" aria-live="polite">
        {joinFeedback}
      </div>

      <section className="lobby-bottom-controls" aria-label="Lobby bottom controls">
        <Link className="connection-panel" to="/chat">
          Connection
        </Link>
        <Pagination currentPage={currentPage} totalPages={totalPages} onSelectPage={setCurrentPage} />
        <img className="corner-logo" src={logo} alt="CampusGG logo" />
      </section>
    </section>
  )
}

export default LobbyFeed
