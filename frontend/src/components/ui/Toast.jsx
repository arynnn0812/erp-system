// App-wide toasts, replacing window.alert. Mounted above the router so a
// toast fired just before navigate() survives the page change.
//   const toast = useToast();
//   toast.success('Saved');  toast.error(errMsg(err));
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);
const ICONS = { success: 'check', error: 'error', info: 'info' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((type, message, title) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, type, message, title }]); // at most 4 on screen
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, title) => push('success', m, title),
    error: (m, title) => push('error', m, title),
    info: (m, title) => push('info', m, title),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Errors are announced assertively, everything else politely. */}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon name={ICONS[t.type]} />
            <div className="toast-msg">
              {t.title && <div className="toast-title">{t.title}</div>}
              {t.message}
            </div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
