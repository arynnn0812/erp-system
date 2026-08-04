// Reusable table with SERVER-side pagination - the parent owns fetching;
// this component only renders rows and page controls.
export default function DataTable({ columns, rows, page, pages, onPage, empty = 'No records' }) {
  return (
    <div className="card">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="pagination">
          <button className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
        </div>
      )}
    </div>
  );
}
