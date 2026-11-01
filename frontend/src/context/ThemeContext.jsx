// Theme preference: 'light' | 'dark' | 'system'. The resolved theme is written
// to <html data-theme>, which is all the CSS looks at. index.html applies the
// saved choice before React loads; this keeps it in sync afterwards.
import { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'erp-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const ThemeContext = createContext(null);

function readPref() {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
}

const resolve = (pref) => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref);

// Written before React re-renders, so anything reading CSS variables during
// that render (the charts) already sees the new theme's values.
function apply(theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState(readPref);
  const [theme, setTheme] = useState(() => resolve(readPref()));

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (pref !== 'system') return undefined;
    const onChange = () => { const t = resolve('system'); apply(t); setTheme(t); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  function setPref(next) {
    try { localStorage.setItem(KEY, next); } catch { /* private mode: still works for this tab */ }
    const t = resolve(next);
    apply(t);
    setPrefState(next);
    setTheme(t);
  }

  return (
    <ThemeContext.Provider value={{ pref, theme, setPref }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
