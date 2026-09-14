function SkillFilter({ selectedSkill, onSelectSkill }) {
  return (
    <div className="filter-group filter-group-right">
      <span className="filter-icon" aria-hidden="true">
        ▽
      </span>
      <button
        className={`filter-chip ${selectedSkill === 'Most Popular' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectSkill('Most Popular')}
      >
        Most Popular
      </button>
      <button
        className={`filter-chip ${selectedSkill === 'Beginner' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectSkill('Beginner')}
      >
        Beginner
      </button>
      <button
        className={`filter-chip ${selectedSkill === 'Intermediate' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectSkill('Intermediate')}
      >
        Intermediate
      </button>
      <button
        className={`filter-chip ${selectedSkill === 'Advanced' ? 'filter-chip-selected' : ''}`}
        type="button"
        onClick={() => onSelectSkill('Advanced')}
      >
        Advanced
      </button>
    </div>
  )
}

export default SkillFilter
