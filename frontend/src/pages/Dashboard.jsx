// Role-aware dashboard: renders whichever numbers the API returned for this
// role (the backend already did the shaping), charts only for ADMIN/MANAGER.
import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatCard from '../components/StatCard.jsx';
import { inr } from '../utils/format.js';

const PIE_COLORS = ['#0f4c81', '#1e8e5a', '#b45309', '#7c3aed', '#c0392b', '#0891b2'];

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [catSales, setCatSales] = useState([]);
  const [top, setTop] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data.data))
      .catch(() => setError('Could not load the dashboard. Check the API is running and refresh.'));
    if (hasRole('ADMIN', 'MANAGER')) {
      api.get('/dashboard/sales-trend?months=6').then((r) => setTrend(r.data.data)).catch(() => {});
      api.get('/dashboard/category-sales').then((r) => setCatSales(r.data.data)).catch(() => {});
      api.get('/dashboard/top-products?limit=5').then((r) => setTop(r.data.data)).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="error">{error}</div>;
  if (!summary) return <div className="page-loading">Loading dashboard…</div>;

  // Colours are assigned to the slices actually drawn, so Cell i matches slice i.
  const pieData = catSales.filter((c) => Number(c.revenue) > 0);

  return (
    <>
      <h2>Welcome, {user.name}</h2>

      <div className="stats">
        {'total_revenue' in summary && <StatCard accent label="Total Revenue" value={inr(summary.total_revenue)} />}
        {'total_orders' in summary && <StatCard label="Orders" value={summary.total_orders} />}
        <StatCard label="Products" value={summary.total_products} />
        <StatCard label="Low Stock" value={summary.low_stock_count} accent={summary.low_stock_count > 0} />
        {'total_customers' in summary && <StatCard label="Customers" value={summary.total_customers} />}
        {'total_employees' in summary && <StatCard label="Employees" value={summary.total_employees} />}
      </div>

      {hasRole('ADMIN', 'MANAGER') && (
        <>
          <div className="grid-2">
            <div className="card">
              <h3>Monthly sales</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v) => inr(v)} />
                  <Line type="monotone" dataKey="revenue" stroke="#0f4c81" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Sales by category</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="revenue" nameKey="category" outerRadius={85} label>
                    {pieData.map((c, i) => <Cell key={c.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => inr(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>Top products (last 90 days)</h3>
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th>Units sold</th><th>Revenue</th></tr></thead>
              <tbody>
                {top.length === 0 && <tr><td colSpan={4} className="empty">No sales yet</td></tr>}
                {top.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td>{p.sku}</td><td>{p.units_sold}</td><td>{inr(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
