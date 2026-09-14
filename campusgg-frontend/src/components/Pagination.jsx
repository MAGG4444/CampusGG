function Pagination({ currentPage, totalPages, onSelectPage }) {
  function goToPrevious() {
    onSelectPage(Math.max(1, currentPage - 1))
  }

  function goToNext() {
    onSelectPage(Math.min(totalPages, currentPage + 1))
  }

  if (totalPages <= 1) {
    return (
      <nav className="pagination" aria-label="Pagination">
        <button className="pagination-item pagination-item-active" type="button" onClick={() => onSelectPage(1)}>
          1
        </button>
      </nav>
    )
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="pagination-item" type="button" onClick={goToPrevious} disabled={currentPage === 1}>
        &larr; Previous
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
        <button
          className={`pagination-item ${currentPage === page ? 'pagination-item-active' : ''}`}
          key={page}
          type="button"
          onClick={() => onSelectPage(page)}
        >
          {page}
        </button>
      ))}
      <button className="pagination-item" type="button" onClick={goToNext} disabled={currentPage === totalPages}>
        Next &rarr;
      </button>
    </nav>
  )
}

export default Pagination
