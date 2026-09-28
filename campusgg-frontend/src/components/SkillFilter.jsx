import { Gauge } from 'lucide-react'

const skills = ['Most Popular', 'Beginner', 'Intermediate', 'Advanced']

function SkillFilter({ selectedSkill, onSelectSkill }) {
  return (
    <div className="filter-group filter-group-right" role="group" aria-label="Filter by skill level">
      <Gauge className="filter-icon" size={18} strokeWidth={2} aria-hidden="true" />
      {skills.map((skill) => (
        <button
          className={`filter-chip ${selectedSkill === skill ? 'filter-chip-selected' : ''}`}
          key={skill}
          type="button"
          aria-pressed={selectedSkill === skill}
          onClick={() => onSelectSkill(skill)}
        >
          {skill}
        </button>
      ))}
    </div>
  )
}

export default SkillFilter
