import { Search } from 'lucide-react'

function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <input
        className="search-input"
        type="text"
        placeholder="Search"
        aria-label="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Search className="search-icon" size={18} strokeWidth={2} aria-hidden="true" />
    </div>
  )
}

export default SearchBar
