// Small presentational pieces shared by every page.
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, pad = false, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

// tone: neutral | success | warning | danger | info | primary
export function Badge({ tone = 'neutral', dot = false, children }) {
  return <span className={`badge badge-${tone}${dot ? ' badge-dot' : ''}`}>{children}</span>;
}

export function Alert({ tone = 'danger', children }) {
  if (!children) return null;
  const icon = tone === 'danger' ? 'error' : tone === 'warning' ? 'alert' : 'info';
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} size={17} />
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 12, style }) {
  return <span className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}

export function EmptyState({ icon = 'inbox', title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <div className="empty-title">{title}</div>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'primary', loading = false }) {
  return (
    <div className="card stat-card">
      {icon && <div className={`stat-icon tone-${tone}`}><Icon name={icon} size={20} /></div>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="stat-label">{label}</div>
        {loading ? <Skeleton width="60%" height={24} style={{ marginTop: 6 }} /> : <div className="stat-value">{value}</div>}
      </div>
    </div>
  );
}

// Search box that reports its value after the user pauses typing, so a
// list page sends one request per search instead of one per keystroke.
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', delay = 300 }) {
  const [text, setText] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    if (text === value) return undefined;
    const t = setTimeout(() => onChangeRef.current(text.trim()), delay);
    return () => clearTimeout(t);
  }, [text, value, delay]);

  return (
    <div className="input-group search-input">
      <Icon name="search" size={16} />
      <input
        className="input" type="search" value={text} placeholder={placeholder} aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onChangeRef.current(text.trim()); }}
      />
    </div>
  );
}
