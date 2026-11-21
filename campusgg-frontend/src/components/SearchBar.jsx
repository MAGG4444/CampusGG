import { Search } from 'lucide-react'

function SearchBar({ value, onChange, label = 'Search', placeholder = 'Search', maxLength }) {
  return (
    <div className="search-bar">
      <input
        className="search-input"
        type="text"
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Search className="search-icon" size={18} strokeWidth={2} aria-hidden="true" />
    </div>
  )
}

export default SearchBar
