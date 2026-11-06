import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api/axios.js';
import { useApi, usePagedList } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useConfirm } from '../../components/ui/ConfirmDialog.jsx';
import { Card, PageHeader } from '../../components/ui/index.jsx';
import { inr, dateLong } from '../../utils/format.js';
import { OrderStatus } from './OrderStatus.jsx';

const NO_FILTERS = { status: '', customerId: '', from: '', to: '' };

export default function Orders() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(NO_FILTERS);
  const list = usePagedList('/orders', filters);
  const customers = useApi('/customers', { limit: 100 });
  const filtered = Object.values(filters).some(Boolean);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  async function cancel(order) {
    const ok = await confirm({
      title: `Cancel order #${order.id}?`,
      message: `The ${order.item_count} ${order.item_count === 1 ? 'item goes' : 'items go'} back into stock. This can't be undone.`,
      confirmLabel: 'Cancel order', cancelLabel: 'Keep order', danger: true,
    });
    if (!ok) return;
    try { await api.post(`/orders/${order.id}/cancel`); toast.success(`Order #${order.id} cancelled, stock restored`); list.reload(); }
    catch (err) { toast.error(errMsg(err)); }
  }

  const columns = [
    { key: 'id', label: 'Order', primary: true, render: (r) => <Link to={`/orders/${r.id}`} className="cell-strong num">#{r.id}</Link> },
    { key: 'order_date', label: 'Date', render: (r) => <span className="nowrap">{dateLong(r.order_date)}</span> },
    { key: 'customer', label: 'Customer' },
    { key: 'item_count', label: 'Items', align: 'right', render: (r) => <span className="num">{r.item_count}</span> },
    { key: 'grand_total', label: 'Total', align: 'right', render: (r) => <span className="num cell-strong">{inr(r.grand_total)}</span> },
    { key: 'status', label: 'Status', render: (r) => <OrderStatus status={r.status} /> },
    {
      key: 'actions', label: '', actions: true,
      render: (r) => (
        <div className="row-end">
          <Button size="sm" variant="ghost" collapse icon="file" onClick={() => navigate(`/orders/${r.id}`)}>Invoice</Button>
          {r.status === 'CONFIRMED' && <Button size="sm" variant="ghost-danger" onClick={() => cancel(r)}>Cancel</Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every sale, newest first. Cancelling an order returns its stock."
        actions={<Link to="/orders/new" className="btn btn-primary"><Icon name="plus" size={17} /> New order</Link>}
      />
      <Card>
        <div className="toolbar filters">
          <select className="select" aria-label="Status" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select className="select" aria-label="Customer" value={filters.customerId} onChange={(e) => set({ customerId: e.target.value })}>
            <option value="">All customers</option>
            {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="inline-field">From
            <input className="input" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
          </label>
          <label className="inline-field">To
            <input className="input" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
          </label>
          {filtered && <Button size="sm" variant="ghost" icon="x" onClick={() => setFilters(NO_FILTERS)}>Clear</Button>}
          {!list.loading && <span className="toolbar-meta">{list.total} {list.total === 1 ? 'order' : 'orders'}</span>}
        </div>
        <DataTable
          caption="Orders"
          columns={columns} rows={list.rows} loading={list.loading} error={list.error}
          page={list.page} pages={list.pages} total={list.total} onPage={list.setPage}
          empty={filtered
            ? { icon: 'filter', title: 'No orders match these filters', action: <Button size="sm" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button> }
            : {
              icon: 'receipt', title: 'No orders yet', message: 'Orders you create will show up here.',
              action: <Link to="/orders/new" className="btn btn-primary btn-sm">Create the first order</Link>,
            }}
        />
      </Card>
    </>
  );
}
