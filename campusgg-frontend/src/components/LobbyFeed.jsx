import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/LOGO.png'
import GameFilter from './GameFilter.jsx'
import HomepageToggle from './HomepageToggle.jsx'
import LobbyCard from './LobbyCard.jsx'
import Pagination from './Pagination.jsx'
import SearchBar from './SearchBar.jsx'
import SkillFilter from './SkillFilter.jsx'

function LobbyFeed() {
  const navigate = useNavigate()
  const [selectedGame, setSelectedGame] = useState('All Games')
  const [selectedSkill, setSelectedSkill] = useState('Most Popular')
  const [searchValue, setSearchValue] = useState('')
  const [isHomepage, setIsHomepage] = useState(true)
  const [selectedPage, setSelectedPage] = useState(1)
  const [joinFeedback, setJoinFeedback] = useState('')

  function handleJoin(lobbyName) {
    setJoinFeedback(`Selected ${lobbyName}`)
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

      <section className="lobby-grid">
        <LobbyCard
          lobbyName="Lobby Name"
          userName="User Name"
          details="Details"
          onJoin={() => handleJoin('Lobby Name')}
        />
        <LobbyCard
          lobbyName="Lobby Name"
          userName="User Name"
          details="Details"
          onJoin={() => handleJoin('Lobby Name')}
        />
        <LobbyCard
          lobbyName="Lobby Name"
          userName="User Name"
          details="Details"
          onJoin={() => handleJoin('Lobby Name')}
        />
        <LobbyCard
          lobbyName="Lobby Name"
          userName="User Name"
          details="Details"
          onJoin={() => handleJoin('Lobby Name')}
        />
        <LobbyCard
          lobbyName="Lobby Name"
          userName="User Name"
          details="Details"
          onJoin={() => handleJoin('Lobby Name')}
        />
        <LobbyCard
          lobbyName="Lobby Name"
          userName="User Name"
          details="Details"
          onJoin={() => handleJoin('Lobby Name')}
        />
      </section>

      <div className="join-feedback" aria-live="polite">
        {joinFeedback}
      </div>

      <section className="lobby-bottom-controls" aria-label="Lobby bottom controls">
        <Link className="connection-panel" to="/chat">
          Connection
        </Link>
        <Pagination selectedPage={selectedPage} onSelectPage={setSelectedPage} />
        <img className="corner-logo" src={logo} alt="CampusGG logo" />
      </section>
    </section>
  )
}

export default LobbyFeed
