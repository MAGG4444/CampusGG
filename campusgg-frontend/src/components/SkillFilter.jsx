const skills = ['Most Popular', 'Beginner', 'Intermediate', 'Advanced']

function SkillFilter({ selectedSkill, onSelectSkill }) {
  return (
    <div className="filter-group filter-group-right">
      <span className="filter-icon" aria-hidden="true">
        ▽
      </span>
      {skills.map((skill) => (
        <button
          className={`filter-chip ${selectedSkill === skill ? 'filter-chip-selected' : ''}`}
          key={skill}
          type="button"
          onClick={() => onSelectSkill(skill)}
        >
          {skill}
        </button>
      ))}
    </div>
  )
}

export default SkillFilter
