// Apply the saved theme before first paint so the page never flashes the
// wrong one. Loaded as a blocking <script> from index.html; kept as a file,
// not inline, so the Content-Security-Policy can stay script-src 'self'.
// Same storage key and rules as src/context/ThemeContext.jsx.
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('erp-theme') || 'system'; } catch { /* storage blocked: follow the system */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
