// Promise-based confirmation dialog, replacing window.confirm:
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Delete?', message: '…', confirmLabel: 'Delete', danger: true }))) return;
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setOpts(options);
  }), []);

  function close(result) {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal
          title={opts.title}
          size="sm"
          onClose={() => close(false)}
          footer={(
            <>
              {/* Destructive prompts start on Cancel, so Enter alone can't delete. */}
              <Button onClick={() => close(false)} data-autofocus={opts.danger || undefined}>
                {opts.cancelLabel || 'Cancel'}
              </Button>
              <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus={!opts.danger || undefined}>
                {opts.confirmLabel || 'Confirm'}
              </Button>
            </>
          )}
        >
          <div className="confirm-body">
            <div className={`confirm-icon${opts.danger ? ' danger' : ''}`}>
              <Icon name={opts.danger ? 'alert' : 'info'} />
            </div>
            <div><p>{opts.message}</p></div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
