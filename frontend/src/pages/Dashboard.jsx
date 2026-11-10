// Role-aware dashboard: renders whichever numbers the API returned for this
// role (the backend already did the shaping), charts only for ADMIN/MANAGER.
// Refreshes itself when the API reports a change (see useLiveUpdates).
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';
import DataTable from '../components/ui/DataTable.jsx';
import { Alert, Card, EmptyState, PageHeader, Skeleton, StatCard } from '../components/ui/index.jsx';
import { inr, inrCompact, monthLabel } from '../utils/format.js';
import { ChartTooltip, useChartColors } from '../components/ui/chart.jsx';

const TREND_MONTHS = 6;

// The API only returns months that had sales; fill the gaps with zero so the
// chart's x-axis is continuous.
function fillMonths(rows, months) {
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.revenue)]));
  const out = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (months - 1));
  for (let i = 0; i < months; i += 1) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month: key, revenue: byMonth.get(key) || 0 });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

const LIVE_LABEL = {
  live: { text: 'Live', title: 'Updates as soon as orders, stock or staff change' },
  connecting: { text: 'Connecting…', title: 'Connecting to live updates' },
  polling: { text: 'Auto-refresh', title: 'Live updates unavailable; refreshing every minute' },
};

function LiveBadge({ status }) {
  const { text, title } = LIVE_LABEL[status];
  return <span className="live-badge" data-status={status} title={title} role="status">{text}</span>;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const colors = useChartColors();
  const seesSales = hasRole('ADMIN', 'MANAGER');

  const summary = useApi('/dashboard/summary');
  const trend = useApi(seesSales ? '/dashboard/sales-trend' : null, { months: TREND_MONTHS });
  const categories = useApi(seesSales ? '/dashboard/category-sales' : null);
  const top = useApi(seesSales ? '/dashboard/top-products' : null, { limit: 5 });

  // reload() is stable per hook, so this is too. Refreshes keep the current
  // figures on screen until the new ones arrive (see `first` below).
  const { reload: r1 } = summary, { reload: r2 } = trend, { reload: r3 } = categories, { reload: r4 } = top;
  const reloadAll = useCallback(() => { r1(); r2(); r3(); r4(); }, [r1, r2, r3, r4]);
  const live = useLiveUpdates(reloadAll);
  // Skeletons only on the first load, not on every live refresh.
  const first = (q) => q.loading && q.data === undefined;

  const s = summary.data || {};
  const trendData = useMemo(() => fillMonths(trend.data || [], TREND_MONTHS), [trend.data]);
  const pieData = useMemo(
    () => (categories.data || []).filter((c) => Number(c.revenue) > 0).map((c) => ({ ...c, revenue: Number(c.revenue) })),
    [categories.data]
  );
  const pieTotal = pieData.reduce((sum, c) => sum + c.revenue, 0);
  const hasTrend = trendData.some((m) => m.revenue > 0);

  // Cards for whichever figures this role was sent; placeholders until then.
  const cards = summary.data ? [
    'total_revenue' in s && { label: 'Revenue', value: inr(s.total_revenue), icon: 'rupee', tone: 'primary' },
    'total_orders' in s && { label: 'Confirmed orders', value: s.total_orders, icon: 'receipt', tone: 'info' },
    { label: 'Active products', value: s.total_products, icon: 'box', tone: 'primary' },
    { label: 'Low stock', value: s.low_stock_count, icon: 'alert', tone: s.low_stock_count > 0 ? 'warning' : 'success' },
    'total_customers' in s && { label: 'Customers', value: s.total_customers, icon: 'users', tone: 'info' },
    'total_employees' in s && { label: 'Employees', value: s.total_employees, icon: 'badge', tone: 'success' },
  ].filter(Boolean) : null;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description="Here's how the business is doing today."
        actions={<>
          <LiveBadge status={live} />
          {hasRole('ADMIN', 'MANAGER') && <Link to="/orders/new" className="btn btn-primary">New order</Link>}
        </>}
      />

      <Alert>{summary.error && 'Could not load the dashboard. Check the API is running, then refresh.'}</Alert>

      <div className="stats">
        {cards
          ? cards.map((c) => <StatCard key={c.label} {...c} />)
          : !summary.error && [0, 1, 2, 3].map((i) => <StatCard key={i} label={<Skeleton width="50%" />} loading />)}
      </div>

      {s.low_stock_count > 0 && (
        <Alert tone="warning">
          {s.low_stock_count} {s.low_stock_count === 1 ? 'product is' : 'products are'} below their reorder level.{' '}
          {seesSales ? <Link to="/inventory/reorder">Open the reorder planner</Link> : <Link to="/inventory">Review inventory</Link>}
        </Alert>
      )}

      {seesSales && (
        <div className="stack">
          <div className="grid-2">
            <Card title="Revenue" subtitle={`Confirmed orders, last ${TREND_MONTHS} months`} pad>
              <div className="chart-box">
                {first(trend) ? <Skeleton height="100%" /> : !hasTrend ? (
                  <EmptyState icon="chart" title="No sales yet" message="Revenue appears here once orders are placed." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.series[0]} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={colors.series[0]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={colors.grid} vertical={false} />
                      <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={{ fill: colors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={inrCompact} tick={{ fill: colors.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip content={<ChartTooltip labelFormat={(m) => monthLabel(m, true)} />} cursor={{ stroke: colors.grid }} />
                      <Area type="monotone" dataKey="revenue" stroke={colors.series[0]} strokeWidth={2.2} fill="url(#revFill)"
                            activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title="Sales by category" subtitle="All-time confirmed revenue" pad>
              <div className="chart-box">
                {first(categories) ? <Skeleton height="100%" /> : pieData.length === 0 ? (
                  <EmptyState icon="layers" title="No category sales yet" message="Each category's share of revenue appears here." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="revenue" nameKey="category" innerRadius="58%" outerRadius="88%"
                               paddingAngle={pieData.length > 1 ? 2 : 0} stroke={colors.surface} strokeWidth={2}>
                            {pieData.map((c, i) => <Cell key={c.category} fill={colors.series[i % colors.series.length]} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="legend">
                      {pieData.map((c, i) => (
                        <span key={c.category}>
                          <i style={{ background: colors.series[i % colors.series.length] }} />
                          {c.category} · {Math.round((c.revenue / pieTotal) * 100)}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card title="Top products" subtitle="By units sold, last 90 days">
            <DataTable
              caption="Top products by units sold"
              loading={first(top)}
              error={top.error}
              rows={top.data || []}
              empty={{ icon: 'box', title: 'No sales in the last 90 days' }}
              columns={[
                { key: 'name', label: 'Product', primary: true, render: (p) => <span className="cell-strong">{p.name}</span> },
                { key: 'sku', label: 'SKU', render: (p) => <span className="mono muted">{p.sku}</span> },
                { key: 'units_sold', label: 'Units sold', align: 'right', render: (p) => <span className="num">{p.units_sold}</span> },
                { key: 'revenue', label: 'Revenue', align: 'right', render: (p) => <span className="num cell-strong">{inr(p.revenue)}</span> },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}
