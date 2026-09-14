function GameFilter({ selectedGame, onSelectGame }) {
  return (
    <div className="filter-group">
      <span className="filter-icon" aria-hidden="true">
        ▽
      </span>
      <button
        className={`filter-chip ${selectedGame === 'All Games' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectGame('All Games')}
      >
        All Games
      </button>
      <button
        className={`filter-chip ${selectedGame === 'Valorant' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectGame('Valorant')}
      >
        Valorant
      </button>
      <button
        className={`filter-chip ${selectedGame === 'CS2' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectGame('CS2')}
      >
        CS2
      </button>
      <button
        className={`filter-chip ${selectedGame === 'Overwatch 2' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectGame('Overwatch 2')}
      >
        Overwatch 2
      </button>
      <button
        className={`filter-chip ${selectedGame === 'Apex' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectGame('Apex')}
      >
        Apex
      </button>
    </div>
  )
}

export default GameFilter
