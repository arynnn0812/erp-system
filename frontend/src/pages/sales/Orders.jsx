import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/axios.js';
import DataTable from '../../components/DataTable.jsx';
import { inr, dateFmt } from '../../utils/format.js';

export default function Orders() {
  const [data, setData] = useState({ rows: [], page: 1, pages: 1 });

  async function load(p = 1) {
    const res = await api.get('/orders', { params: { page: p, limit: 10 } });
    setData(res.data);
  }
  useEffect(() => { load(1); }, []);

  async function cancel(id) {
    if (!confirm(`Cancel order #${id}? Stock will be restored.`)) return;
    try { await api.post(`/orders/${id}/cancel`); load(data.page); }
    catch (err) { alert(errMsg(err)); }
  }

  const columns = [
    { key: 'id', label: '#' },
    { key: 'order_date', label: 'Date', render: (r) => dateFmt(r.order_date) },
    { key: 'customer', label: 'Customer' },
    { key: 'item_count', label: 'Items' },
    { key: 'grand_total', label: 'Total', render: (r) => inr(r.grand_total) },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span className={r.status === 'CONFIRMED' ? 'tag-ok' : 'tag-cancel'}>{r.status}</span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r) => r.status === 'CONFIRMED' && (
        <button className="btn btn-danger" onClick={() => cancel(r.id)}>Cancel</button>
      ),
    },
  ];

  return (
    <>
      <div className="row-between">
        <h2>Orders</h2>
        <Link to="/orders/new"><button className="btn btn-primary">+ New order</button></Link>
      </div>
      <DataTable columns={columns} rows={data.rows} page={data.page} pages={data.pages} onPage={load} />
    </>
  );
}
