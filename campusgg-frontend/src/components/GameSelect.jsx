import { suggestedGames } from '../utils/profile.js'
import './GameSelect.css'

export default function GameSelect({
  id,
  value,
  onChange,
  invalid = false,
  describedBy,
}) {
  const savedGameIsCustom = Boolean(
    value && !suggestedGames.includes(value),
  )

  return (
    <select
      className="game-select"
      id={id}
      value={value}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">No game selected</option>
      {savedGameIsCustom ? (
        <option value={value}>{value} (saved)</option>
      ) : null}
      {suggestedGames.map((game) => (
        <option key={game} value={game}>{game}</option>
      ))}
    </select>
  )
}
