// Read-only view of the append-only audit log (ADMIN). Each row is one
// sensitive action: sign-ins, access changes, stock movements, orders,
// salary changes and document access.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, usePagedList } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge, Card, PageHeader } from '../../components/ui/index.jsx';
import { tsDateTime } from '../../utils/format.js';

const ACTIONS = {
  LOGIN: ['Signed in', 'neutral'],
  LOGIN_FAILED: ['Failed sign-in', 'danger'],
  LOGOUT_ALL: ['Signed out everywhere', 'neutral'],
  PASSWORD_CHANGE: ['Changed password', 'info'],
  PASSWORD_RESET: ['Reset a password', 'warning'],
  USER_CREATE: ['Created a user', 'primary'],
  USER_ACCESS_CHANGE: ['Changed access', 'warning'],
  STOCK_IN: ['Stock in', 'success'],
  STOCK_OUT: ['Stock out', 'warning'],
  PRODUCT_DELETE: ['Deactivated a product', 'danger'],
  ORDER_CREATE: ['Created an order', 'success'],
  ORDER_CANCEL: ['Cancelled an order', 'danger'],
  EMPLOYEE_CREATE: ['Added an employee', 'primary'],
  EMPLOYEE_DELETE: ['Deleted an employee', 'danger'],
  SALARY_CHANGE: ['Changed a salary', 'warning'],
  DOCUMENT_UPLOAD: ['Uploaded a document', 'info'],
  DOCUMENT_DOWNLOAD: ['Downloaded a document', 'neutral'],
  DOCUMENT_DELETE: ['Deleted a document', 'danger'],
};
const actionLabel = (a) => ACTIONS[a]?.[0] || a.toLowerCase().replace(/_/g, ' ');

// Entities that have a page get a link.
function Target({ entity, id }) {
  if (!entity) return <span className="muted">—</span>;
  if (entity === 'orders') return <Link to={`/orders/${id}`} className="nowrap">Order #{id}</Link>;
  if (entity === 'products') return <Link to={`/inventory/${id}`} className="nowrap">Product #{id}</Link>;
  return <span className="nowrap">{entity.replace(/s$/, '')} #{id}</span>;
}

const NO_FILTERS = { action: '', userId: '', from: '', to: '' };

export default function AuditLog() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [detail, setDetail] = useState(null);
  const list = usePagedList('/audit-logs', filters, { limit: 25 });
  const actions = useApi('/audit-logs/actions');
  const users = useApi('/users');
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of sensitive actions. Entries can't be edited or deleted." />
      <Card>
        <div className="toolbar filters">
          <select className="select" aria-label="Action" value={filters.action} onChange={(e) => set({ action: e.target.value })}>
            <option value="">All actions</option>
            {(actions.data || []).map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
          <select className="select" aria-label="User" value={filters.userId} onChange={(e) => set({ userId: e.target.value })}>
            <option value="">All users</option>
            {(users.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <label className="inline-field">From
            <input className="input" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
          </label>
          <label className="inline-field">To
            <input className="input" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
          </label>
          {filtered && <Button size="sm" variant="ghost" icon="x" onClick={() => setFilters(NO_FILTERS)}>Clear</Button>}
          {!list.loading && <span className="toolbar-meta">{list.total} {list.total === 1 ? 'entry' : 'entries'}</span>}
        </div>
        <DataTable
          caption="Audit log"
          rows={list.rows} loading={list.loading} error={list.error}
          page={list.page} pages={list.pages} total={list.total} onPage={list.setPage}
          empty={{ icon: 'list', title: filtered ? 'No entries match these filters' : 'No entries yet' }}
          columns={[
            { key: 'created_at', label: 'When', render: (r) => <span className="nowrap">{tsDateTime(r.created_at)}</span> },
            {
              key: 'user', label: 'User', primary: true,
              render: (r) => (r.user_name
                ? <><span className="cell-strong">{r.user_name}</span><span className="cell-sub">{r.user_email}</span></>
                : <span className="muted">Unknown / signed out</span>),
            },
            { key: 'action', label: 'Action', render: (r) => <Badge tone={ACTIONS[r.action]?.[1] || 'neutral'}>{actionLabel(r.action)}</Badge> },
            { key: 'entity', label: 'Target', render: (r) => <Target entity={r.entity} id={r.entity_id} /> },
            { key: 'ip_address', label: 'IP', render: (r) => <span className="mono muted">{r.ip_address || '—'}</span> },
            {
              key: 'actions', label: '', actions: true,
              render: (r) => r.details && <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>Details</Button>,
            },
          ]}
        />
      </Card>

      {detail && (
        <Modal title={`${actionLabel(detail.action)} · ${tsDateTime(detail.created_at)}`} onClose={() => setDetail(null)}>
          <pre className="json-block">{JSON.stringify(detail.details, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
