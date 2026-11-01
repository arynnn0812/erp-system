// Minimal RFC 4180 CSV writer.
//
// Cells that start with = + - @ (or a tab/CR) are prefixed with a quote:
// spreadsheet apps would otherwise run them as formulas, so a customer named
// "=HYPERLINK(...)" could execute in whoever opens the export (CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/; // "-500.00" is data, not a formula

function cell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [[key, header], ...]
function toCsv(rows, columns) {
  const lines = [columns.map(([, header]) => cell(header)).join(',')];
  for (const row of rows) lines.push(columns.map(([key]) => cell(row[key])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

module.exports = { toCsv };
