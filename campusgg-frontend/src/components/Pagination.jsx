function Pagination({ selectedPage, onSelectPage }) {
  function goToPrevious() {
    onSelectPage(Math.max(1, selectedPage - 1))
  }

  function goToNext() {
    onSelectPage(Math.min(68, selectedPage + 1))
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="pagination-item" type="button" onClick={goToPrevious}>
        &larr; Previous
      </button>
      <button
        className={`pagination-item ${selectedPage === 1 ? 'pagination-item-active' : ''}`}
        type="button"
        onClick={() => onSelectPage(1)}
      >
        1
      </button>
      <button
        className={`pagination-item ${selectedPage === 2 ? 'pagination-item-active' : ''}`}
        type="button"
        onClick={() => onSelectPage(2)}
      >
        2
      </button>
      <button
        className={`pagination-item ${selectedPage === 3 ? 'pagination-item-active' : ''}`}
        type="button"
        onClick={() => onSelectPage(3)}
      >
        3
      </button>
      <span className="pagination-item">...</span>
      <button
        className={`pagination-item ${selectedPage === 67 ? 'pagination-item-active' : ''}`}
        type="button"
        onClick={() => onSelectPage(67)}
      >
        67
      </button>
      <button
        className={`pagination-item ${selectedPage === 68 ? 'pagination-item-active' : ''}`}
        type="button"
        onClick={() => onSelectPage(68)}
      >
        68
      </button>
      <button className="pagination-item" type="button" onClick={goToNext}>
        Next &rarr;
      </button>
    </nav>
  )
}

export default Pagination
