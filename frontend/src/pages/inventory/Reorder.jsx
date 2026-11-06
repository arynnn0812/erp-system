// Reorder planner: which products to buy, and how many, from how fast each
// one actually sold. The numbers are computed by the API from order history;
// this page explains them and lets the user tune the assumptions.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import { Alert, Badge, Card, PageHeader, StatCard } from '../../components/ui/index.jsx';
import { inr } from '../../utils/format.js';

const STATUS = {
  OUT: <Badge tone="danger" dot>Out of stock</Badge>,
  REORDER: <Badge tone="warning" dot>Reorder now</Badge>,
  OK: <Badge tone="success" dot>Healthy</Badge>,
};

const OPTIONS = {
  days: [[14, '14 days'], [30, '30 days'], [60, '60 days'], [90, '90 days']],
  cover: [[14, '2 weeks'], [30, '1 month'], [60, '2 months'], [90, '3 months']],
  leadTime: [[3, '3 days'], [7, '1 week'], [14, '2 weeks'], [30, '1 month']],
};

export default function Reorder() {
  const [settings, setSettings] = useState({ days: 30, cover: 30, leadTime: 7 });
  const [onlyAction, setOnlyAction] = useState(true);
  const plan = useApi('/products/insights/reorder', settings);
  const rows = plan.data || [];
  const needed = rows.filter((r) => r.status !== 'OK' || r.suggested_qty > 0);
  const shown = onlyAction ? needed : rows;
  const cost = needed.reduce((sum, r) => sum + r.suggested_qty * Number(r.price), 0);

  const select = (key, label) => (
    <label className="inline-field">{label}
      <select className="select" value={settings[key]} onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}>
        {OPTIONS[key].map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <PageHeader title="Reorder planner" description="What to buy next, based on how fast each product is actually selling." />

      <div className="stats">
        <StatCard label="Out of stock" icon="alert" tone="danger" value={rows.filter((r) => r.status === 'OUT').length} loading={plan.loading} />
        <StatCard label="Need reordering" icon="bolt" tone="warning" value={rows.filter((r) => r.status === 'REORDER').length} loading={plan.loading} />
        <StatCard label="Suggested purchase (at sale price)" icon="cart" value={inr(cost)} loading={plan.loading} />
      </div>

      <Alert>{plan.error}</Alert>

      <Card>
        <div className="toolbar filters">
          {select('days', 'Sales from the last')}
          {select('cover', 'Buy enough for')}
          {select('leadTime', 'Supplier lead time')}
          <label className="inline-field check">
            <input type="checkbox" checked={onlyAction} onChange={(e) => setOnlyAction(e.target.checked)} /> Only products to order
          </label>
        </div>
        <DataTable
          caption="Reorder plan"
          rows={shown} loading={plan.loading}
          empty={onlyAction
            ? { icon: 'check', title: 'Nothing to reorder', message: 'Every product has enough stock for the period you chose.' }
            : { icon: 'box', title: 'No products yet' }}
          columns={[
            {
              key: 'name', label: 'Product', primary: true,
              render: (r) => <><Link to={`/inventory/${r.id}`} className="cell-strong">{r.name}</Link><span className="cell-sub mono">{r.sku}{r.supplier ? ` · ${r.supplier}` : ''}</span></>,
            },
            { key: 'status', label: 'Status', render: (r) => STATUS[r.status] },
            { key: 'quantity', label: 'On hand', align: 'right', render: (r) => <span className="num">{r.quantity}<span className="muted"> / {r.reorder_level}</span></span> },
            { key: 'daily_velocity', label: 'Sells per day', align: 'right', render: (r) => <span className="num">{r.daily_velocity || <span className="muted">—</span>}</span> },
            {
              key: 'days_of_stock', label: 'Lasts',
              align: 'right',
              render: (r) => (r.days_of_stock === null
                ? <span className="muted">no recent sales</span>
                : <span className={`num${r.days_of_stock < settings.leadTime ? ' text-warning' : ''}`}>{r.days_of_stock} days</span>),
            },
            {
              key: 'suggested_qty', label: 'Order',
              align: 'right',
              render: (r) => (r.suggested_qty > 0
                ? <span className="num cell-strong">{r.suggested_qty}</span>
                : <span className="muted">—</span>),
            },
          ]}
        />
        <p className="card-foot-note">
          <strong>How this is worked out:</strong> sales per day = units sold in confirmed orders over the period ÷ its length.
          Suggested order = enough for the period you buy for, plus the reorder level kept as safety stock, minus what is on hand.
          A product is flagged when it is below its reorder level or will run out before a new delivery could arrive.
        </p>
      </Card>
    </>
  );
}
