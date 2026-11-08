import { suggestedGames } from '../utils/profile.js'
import { matchmakingGames } from '../utils/supportedGames.js'

const primaryGames = ['CS2', 'Valorant', 'Overwatch 2']
const baseGames = [...new Set([...primaryGames, 'Apex', ...suggestedGames, ...matchmakingGames])]
const skills = ['Any Skill', 'Beginner', 'Intermediate', 'Advanced']
const capacities = [['any', 'Any'], ['2', '2'], ['5', '5'], ['10', '10'], ['unlimited', 'Unlimited (∞)']]

function Choices({ label, values, selected, onSelect }) {
  return <fieldset className="lobby-filter-group"><legend>{label}</legend>
    {values.map(([value, text]) => <button key={value} className={`lobby-filter-option ${selected === value ? 'is-selected' : ''}`}
      type="button" aria-pressed={selected === value} onClick={() => onSelect(value)}>{text}</button>)}
  </fieldset>
}

export function ActiveLobbyFilters({ game, skill, capacity, visibility, onChange, onClear }) {
  const items = [
    game !== 'All Games' && ['game', game],
    skill !== 'Any Skill' && ['skill', skill],
    capacity !== 'any' && ['capacity', `Capacity: ${capacity === 'unlimited' ? '∞' : capacity}`],
    visibility !== 'all' && ['visibility', 'Public'],
  ].filter(Boolean)
  if (!items.length) return null
  const defaults = { game: 'All Games', skill: 'Any Skill', capacity: 'any', visibility: 'all' }
  return <div className="lobby-active-filters" aria-label="Active filters">
    {items.map(([key, text]) => <button type="button" key={key} onClick={() => onChange(key, defaults[key])} aria-label={`Remove ${text} filter`}>{text} ×</button>)}
    <button type="button" className="lobby-clear-filters" onClick={onClear}>Clear All</button>
  </div>
}

export default function LobbyFilters({ open, game, skill, capacity, visibility, onChange, availableGames = [] }) {
  const games = [...new Set([...baseGames, ...availableGames.filter(Boolean)])]
  const moreGames = games.filter(value => !primaryGames.includes(value))
  return <aside id="lobby-filters" className="lobby-filters" aria-label="Filters" aria-hidden={!open} inert={!open} tabIndex={open ? 0 : -1}>
    <h2 className="lobby-filters-title">Filters</h2>
    <div className="lobby-filter-options" tabIndex={open ? 0 : -1} aria-label="Filter options">
    <Choices label="Game" values={['All Games', ...primaryGames].map(value => [value, value])} selected={game} onSelect={value => onChange('game', value)} />
    {moreGames.length > 0 && <details className="lobby-more-games" open={moreGames.includes(game) || undefined}><summary>More games</summary>
      {moreGames.map(value => <button className={`lobby-filter-option ${game === value ? 'is-selected' : ''}`} type="button" key={value} aria-pressed={game === value} onClick={() => onChange('game', value)}>{value}</button>)}
    </details>}
    <Choices label="Skill Level" values={skills.map(value => [value, value])} selected={skill} onSelect={value => onChange('skill', value)} />
    <details className="lobby-more-filters">
      <summary>More Filters</summary>
      <Choices label="Lobby Capacity" values={capacities} selected={capacity} onSelect={value => onChange('capacity', value)} />
      <Choices label="Visibility" values={[[ 'all', 'All visible' ], [ 'public', 'Public' ]]} selected={visibility} onSelect={value => onChange('visibility', value)} />
    </details>
    </div>
  </aside>
}
