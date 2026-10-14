import { Gamepad2 } from 'lucide-react'

const games = ['All Games', 'Valorant', 'CS2', 'Overwatch 2', 'Apex']

function GameFilter({ selectedGame, onSelectGame }) {
  return (
    <div className="filter-group" role="group" aria-label="Filter by game">
      <Gamepad2 className="filter-icon" size={18} strokeWidth={2} aria-hidden="true" />
      {games.map((game) => (
        <button
          className={`filter-chip ${selectedGame === game ? 'filter-chip-selected' : ''}`}
          key={game}
          type="button"
          aria-pressed={selectedGame === game}
          onClick={() => onSelectGame(game)}
        >
          {game}
        </button>
      ))}
    </div>
  )
}

export default GameFilter
