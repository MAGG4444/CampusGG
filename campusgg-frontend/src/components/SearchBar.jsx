function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <input
        className="search-input"
        type="text"
        placeholder="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="search-icon" aria-hidden="true">
        ⌕
      </span>
    </div>
  )
}

export default SearchBar
