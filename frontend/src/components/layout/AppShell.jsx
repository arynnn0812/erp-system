// Signed-in layout: sidebar navigation, top bar, and the routed page.
// Below 960px the sidebar becomes a drawer opened from the top bar; it
// closes on Esc, on a backdrop tap and whenever the route changes.
import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { navFor, titleFor, ROLE_LABEL } from '../../config/nav.js';
import Icon from '../ui/Icon.jsx';
import { Skeleton } from '../ui/index.jsx';
import ThemeSwitch from './ThemeSwitch.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// Shown while a page's code chunk downloads (usually a few milliseconds).
function PageFallback() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading page">
      <Skeleton width={220} height={26} />
      <Skeleton height={320} style={{ borderRadius: 'var(--radius)' }} />
    </div>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState({ open: false, path: pathname });
  const menuButton = useRef(null);
  const sidebar = useRef(null);
  const title = titleFor(pathname);

  // A drawer opened on another route is closed (derived, no effect needed).
  const open = drawer.open && drawer.path === pathname;
  const setOpen = (v) => setDrawer({ open: v, path: pathname });

  useEffect(() => { document.title = `${title} · ERP System`; }, [title]);

  useEffect(() => {
    if (!open) return undefined;
    sidebar.current?.querySelector('a')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { setDrawer((d) => ({ ...d, open: false })); menuButton.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function signOut() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>

      <aside ref={sidebar} id="sidebar" className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">E</span>
          ERP System
        </div>
        <nav className="sidebar-nav">
          {navFor(user.role).map((section) => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-title">{section.section}</div>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/' || item.end} className="nav-link">
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <NavLink to="/profile" className="sidebar-user" title="My profile">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{ROLE_LABEL[user.role] || user.role}</div>
          </div>
        </NavLink>
      </aside>
      <div className={`sidebar-backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="content">
        <header className="topbar">
          <button
            ref={menuButton} type="button" className="btn btn-ghost btn-icon menu-button"
            aria-label="Open navigation" aria-controls="sidebar" aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-title">{title}</div>
          <ThemeSwitch />
          <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
            <Icon name="logout" size={16} /> <span className="hide-xs">Sign out</span>
          </button>
        </header>

        <main id="main" className="main" tabIndex={-1}>
          {/* Keyed by path: a crash on one page is cleared by navigating away. */}
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
