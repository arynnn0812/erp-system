import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/axios.js';
import { usePagedList } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useConfirm } from '../../components/ui/ConfirmDialog.jsx';
import { Badge, Card, PageHeader } from '../../components/ui/index.jsx';
import { inr, dateLong } from '../../utils/format.js';

export default function Orders() {
  const toast = useToast();
  const confirm = useConfirm();
  const list = usePagedList('/orders');

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
    { key: 'id', label: 'Order', primary: true, render: (r) => <span className="cell-strong num">#{r.id}</span> },
    { key: 'order_date', label: 'Date', render: (r) => <span className="nowrap">{dateLong(r.order_date)}</span> },
    { key: 'customer', label: 'Customer' },
    { key: 'item_count', label: 'Items', align: 'right', render: (r) => <span className="num">{r.item_count}</span> },
    { key: 'grand_total', label: 'Total', align: 'right', render: (r) => <span className="num cell-strong">{inr(r.grand_total)}</span> },
    {
      key: 'status', label: 'Status',
      render: (r) => (r.status === 'CONFIRMED'
        ? <Badge tone="success" dot>Confirmed</Badge>
        : <Badge tone="neutral" dot>Cancelled</Badge>),
    },
    {
      key: 'actions', label: '', actions: true,
      render: (r) => r.status === 'CONFIRMED' && (
        <Button size="sm" variant="ghost-danger" onClick={() => cancel(r)}>Cancel</Button>
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
        <DataTable
          caption="Orders"
          columns={columns} rows={list.rows} loading={list.loading} error={list.error}
          page={list.page} pages={list.pages} total={list.total} onPage={list.setPage}
          empty={{
            icon: 'receipt', title: 'No orders yet', message: 'Orders you create will show up here.',
            action: <Link to="/orders/new" className="btn btn-primary btn-sm">Create the first order</Link>,
          }}
        />
      </Card>
    </>
  );
}
