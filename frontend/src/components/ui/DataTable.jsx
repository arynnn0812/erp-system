// Table for list pages. The parent owns fetching (usually via usePagedList);
// this renders rows, a skeleton on first load, a dimmed body on refetch, an
// empty state, and pager controls. On narrow screens CSS turns each row into
// a labelled card using the data-label attribute set on every cell.
//
// column: { key, label, render?(row), align?: 'right', primary?: bool, actions?: bool }
import Icon from './Icon.jsx';
import { EmptyState, Skeleton } from './index.jsx';

export default function DataTable({
  columns, rows, loading = false, error = '', empty = {}, rowKey = 'id',
  page, pages, total, onPage, caption,
}) {
  const firstLoad = loading && rows.length === 0;
  const cellClass = (c) => [
    c.align === 'right' && 'align-right',
    c.primary && 'cell-primary',
    c.actions && 'cell-actions',
  ].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <div className="table-wrap">
        <table className={`table table-responsive${loading && !firstLoad ? ' table-busy' : ''}`} aria-busy={loading || undefined}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cellClass(c)}>
                  {c.actions && !c.label ? <span className="sr-only">Actions</span> : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firstLoad && [0, 1, 2, 3, 4].map((i) => (
              <tr key={`sk-${i}`}>
                {columns.map((c) => (
                  <td key={c.key} data-label="">
                    <Skeleton width={c.actions ? 60 : `${55 + ((i * 17 + c.key.length * 7) % 40)}%`} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} data-label="">
                  <EmptyState title={empty.title || 'Nothing here yet'} message={empty.message} icon={empty.icon} action={empty.action} />
                </td>
              </tr>
            )}
            {error && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} data-label="">
                  <EmptyState icon="error" title="Could not load this list" message={error} />
                </td>
              </tr>
            )}
            {!firstLoad && rows.map((row, i) => (
              <tr key={row[rowKey] ?? i}>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.actions || c.primary ? '' : c.label} className={cellClass(c)}>
                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onPage && pages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <span className="num">
            Page {page} of {pages}{typeof total === 'number' && ` · ${total} records`}
          </span>
          <div className="row">
            <button type="button" className="btn btn-sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
              <Icon name="chevronLeft" size={15} /> Previous
            </button>
            <button type="button" className="btn btn-sm" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>
              Next <Icon name="chevronRight" size={15} />
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
