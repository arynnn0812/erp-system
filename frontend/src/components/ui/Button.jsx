// Button with variants, sizes, an optional icon and a loading state.
// type defaults to "button" so a button inside a form never submits it by
// accident; submit buttons say type="submit".
import Icon from './Icon.jsx';

// collapse: in crowded table rows on mid-size screens the text is visually
// hidden (still read by screen readers) and only the icon shows.
export default function Button({
  variant = 'secondary', size, icon, loading = false, block = false,
  iconOnly = false, collapse = false, type = 'button', className = '', disabled, children, ...rest
}) {
  const cls = [
    'btn',
    variant !== 'secondary' && `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    iconOnly && 'btn-icon',
    block && 'btn-block',
    collapse && 'btn-collapse',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined}
      title={collapse && typeof children === 'string' ? children : undefined} {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {collapse ? <span className="btn-text">{children}</span> : children}
    </button>
  );
}

export function Spinner({ large = false, label = 'Loading' }) {
  return <span className={`spinner${large ? ' spinner-lg' : ''}`} role="status" aria-label={label} />;
}
