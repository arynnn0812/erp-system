// Sales report for a date range: totals, revenue per day, best sellers, and a
// CSV export of every order in the range. Only confirmed orders count toward
// revenue; the export lists cancelled ones too so the file reconciles.
import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import api, { errMsg } from '../../api/axios.js';
import { useApi } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Alert, Card, EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/index.jsx';
import { ChartTooltip, useChartColors } from '../../components/ui/chart.jsx';
import { inr, inrCompact, isoDate, dayLabel, dateLong, saveBlob } from '../../utils/format.js';

const MAX_DAYS = 366; // the API's limit
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d); };

const PRESETS = [
  { key: '7d', label: 'Last 7 days', range: () => [daysAgo(6), isoDate()] },
  { key: '30d', label: 'Last 30 days', range: () => [daysAgo(29), isoDate()] },
  { key: '90d', label: 'Last 90 days', range: () => [daysAgo(89), isoDate()] },
  { key: 'month', label: 'This month', range: () => { const d = new Date(); return [isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), isoDate()]; } },
  { key: 'year', label: 'This year', range: () => [`${new Date().getFullYear()}-01-01`, isoDate()] },
];

const spanDays = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

// One point per calendar day, zero where there were no sales.
function fillDays(rows, from, to) {
  const byDay = new Map(rows.map((r) => [String(r.day).slice(0, 10), Number(r.revenue)]));
  const out = [];
  const [y, m, d] = from.split('-').map(Number);
  for (let cur = new Date(y, m - 1, d); isoDate(cur) <= to; cur.setDate(cur.getDate() + 1)) {
    const key = isoDate(cur);
    out.push({ day: key, revenue: byDay.get(key) || 0 });
  }
  return out;
}

export default function Reports() {
  const toast = useToast();
  const colors = useChartColors();
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState(() => PRESETS[1].range());
  const [from, to] = range;
  const [exporting, setExporting] = useState(false);

  const span = spanDays(from, to);
  const invalid = !from || !to ? 'Pick both dates.'
    : span < 0 ? 'The start date is after the end date.'
      : span > MAX_DAYS ? `A report can cover at most ${MAX_DAYS} days.` : '';
  const params = invalid ? null : { from, to };

  const summary = useApi(params && '/orders/reports/summary', params);
  const daily = useApi(params && '/orders/reports/daily', params);
  const top = useApi(params && '/orders/reports/top-products', params && { ...params, limit: 10 });

  const series = useMemo(() => (params && daily.data ? fillDays(daily.data, from, to) : []), [daily.data, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = summary.data;

  function choose(key) {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key);
    if (p) setRange(p.range());
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get('/orders/reports/export', { params, responseType: 'blob' });
      saveBlob(res.data, `orders-${from}-to-${to}.csv`);
      toast.success('Your CSV is downloading.', 'Export ready');
    } catch (err) {
      // A blob error body has to be read as text before it can be shown.
      let message = errMsg(err);
      if (err.response?.data instanceof Blob) {
        try { message = JSON.parse(await err.response.data.text()).message || message; } catch { /* keep generic */ }
      }
      toast.error(message, 'Export failed');
    } finally { setExporting(false); }
  }

  return (
    <>
      <PageHeader
        title="Sales report"
        description={params ? `${dateLong(from)} – ${dateLong(to)} · confirmed orders` : 'Choose a date range'}
        actions={<Button icon="download" onClick={exportCsv} loading={exporting} disabled={!params}>Export CSV</Button>}
      />

      <Card className="report-controls">
        <div className="toolbar filters">
          <div className="segmented segmented-text" role="group" aria-label="Date range">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => choose(p.key)}>{p.label}</button>
            ))}
          </div>
          <label className="inline-field">From
            <input className="input" type="date" value={from} max={to} onChange={(e) => { setPreset('custom'); setRange([e.target.value, to]); }} />
          </label>
          <label className="inline-field">To
            <input className="input" type="date" value={to} min={from} max={isoDate()} onChange={(e) => { setPreset('custom'); setRange([from, e.target.value]); }} />
          </label>
        </div>
      </Card>

      {invalid ? <Alert tone="warning">{invalid}</Alert> : (
        <>
          <Alert>{summary.error || daily.error || top.error}</Alert>
          <div className="stats" style={{ marginTop: 'var(--sp-5)' }}>
            <StatCard label="Revenue" icon="rupee" value={s && inr(s.revenue)} loading={summary.loading} />
            <StatCard label="Orders" icon="receipt" tone="info" value={s?.order_count} loading={summary.loading} />
            <StatCard label="Average order" icon="chart" tone="success" value={s && inr(s.avg_order_value)} loading={summary.loading} />
          </div>

          <div className="stack">
            <Card title="Revenue by day" subtitle="Confirmed orders only" pad>
              <div className="chart-box">
                {daily.loading ? <Skeleton height="100%" /> : !series.some((d) => d.revenue > 0) ? (
                  <EmptyState icon="chart" title="No sales in this range" message="Try a wider date range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dayFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.series[0]} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={colors.series[0]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={colors.grid} vertical={false} />
                      <XAxis dataKey="day" tickFormatter={(d) => dayLabel(d)} minTickGap={24} tick={{ fill: colors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={inrCompact} tick={{ fill: colors.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip content={<ChartTooltip labelFormat={(d) => dateLong(d)} />} cursor={{ stroke: colors.grid }} />
                      <Area type="monotone" dataKey="revenue" stroke={colors.series[0]} strokeWidth={2} fill="url(#dayFill)"
                            dot={series.length <= 31 ? { r: 2.5, fill: colors.series[0], strokeWidth: 0 } : false}
                            activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title="Best sellers" subtitle="Top 10 by units sold in this range">
              <DataTable
                caption="Best sellers"
                loading={top.loading}
                rows={top.data || []}
                empty={{ icon: 'box', title: 'No products sold in this range' }}
                columns={[
                  { key: 'rank', label: '#', render: (p) => <span className="muted num">{(top.data || []).indexOf(p) + 1}</span> },
                  { key: 'name', label: 'Product', primary: true, render: (p) => <><span className="cell-strong">{p.name}</span><span className="cell-sub mono">{p.sku}</span></> },
                  { key: 'units_sold', label: 'Units', align: 'right', render: (p) => <span className="num">{p.units_sold}</span> },
                  { key: 'revenue', label: 'Revenue', align: 'right', render: (p) => <span className="num cell-strong">{inr(p.revenue)}</span> },
                  {
                    key: 'share', label: 'Share of revenue', align: 'right',
                    render: (p) => (s && Number(s.revenue) > 0
                      ? <span className="num">{((Number(p.revenue) / Number(s.revenue)) * 100).toFixed(1)}%</span> : '—'),
                  },
                ]}
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
