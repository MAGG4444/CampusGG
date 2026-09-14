const games = ['All Games', 'Valorant', 'CS2', 'Overwatch 2', 'Apex']

function GameFilter({ selectedGame, onSelectGame }) {
  return (
    <div className="filter-group">
      <span className="filter-icon" aria-hidden="true">
        ▽
      </span>
      {games.map((game) => (
        <button
          className={`filter-chip ${selectedGame === game ? 'filter-chip-selected' : ''}`}
          key={game}
          type="button"
          onClick={() => onSelectGame(game)}
        >
          {game}
        </button>
      ))}
    </div>
  )
}

export default GameFilter
