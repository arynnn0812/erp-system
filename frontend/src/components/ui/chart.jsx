// Shared chart helpers for the Recharts-based pages.
import { useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { inr } from '../../utils/format.js';

// Recharts draws SVG attributes, which can't use var(); read the current
// theme's token values instead (re-read whenever the theme changes).
export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return {
      series: [1, 2, 3, 4, 5, 6].map((i) => v(`--chart-${i}`)),
      grid: v('--chart-grid'),
      axis: v('--muted'),
      surface: v('--surface'),
    };
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function ChartTooltip({ active, payload, label, labelFormat = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="muted">{labelFormat(label ?? payload[0].name)}</div>
      <strong className="num">{inr(payload[0].value)}</strong>
    </div>
  );
}
