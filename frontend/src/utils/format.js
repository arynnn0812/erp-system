const inrFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrShort = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

export const inr = (n) => inrFormat.format(Number(n) || 0);

// Paise shown: for prices and order lines, where rounding would mislead.
export const inrExact = (n) => inrPrecise.format(Number(n) || 0);

// Chart axes: ₹1.2L, ₹3.4Cr.
export const inrCompact = (n) => inrShort.format(Number(n) || 0);

export const dateFmt = (d) => (d ? String(d).slice(0, 10) : '—');

// "2026-07-14" -> "14 Jul 2026". Parsed by parts so no timezone can shift the day.
export function dateLong(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// "2026-07" -> "Jul" (or "Jul 2026" with withYear).
export function monthLabel(ym, withYear = false) {
  const [y, m] = String(ym).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', withYear ? { month: 'short', year: 'numeric' } : { month: 'short' });
}
