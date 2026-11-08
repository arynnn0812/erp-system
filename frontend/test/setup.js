// Unmount whatever a test rendered (Testing Library only does this by itself
// when Vitest globals are on, and they are not).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

// jsdom has no matchMedia; ThemeContext reads prefers-color-scheme at import.
// Answer "no match" (light theme, no reduced motion).
window.matchMedia ||= (query) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
});
