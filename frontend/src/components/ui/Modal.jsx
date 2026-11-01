// Accessible dialog: rendered in a portal, role="dialog" + aria-modal,
// labelled by its title, Esc to close, Tab kept inside, focus restored to
// whatever opened it, page scroll locked. Dialogs stack (a confirm opened
// from a form): only the topmost one reacts to Esc and traps focus.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

const stack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, size, children, footer }) {
  const titleId = useId();
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const node = ref.current;
    const opener = document.activeElement;
    stack.push(node);
    document.body.classList.add('modal-open');

    // Prefer the field marked autoFocus, then the first field, then the dialog.
    const first = node.querySelector('[autofocus], [data-autofocus]')
      || node.querySelector('.modal-body input, .modal-body select, .modal-body textarea')
      || node.querySelector(FOCUSABLE);
    (first || node).focus();

    function onKey(e) {
      if (stack[stack.length - 1] !== node) return;
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    }
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(node), 1);
      if (stack.length === 0) document.body.classList.remove('modal-open');
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  // mousedown, not click: a drag that starts inside and ends on the backdrop
  // (selecting text in a field) must not close the dialog.
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onBackdrop}>
      <div
        ref={ref} className={`modal${size ? ` modal-${size}` : ''}`}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// Footer row for forms inside a modal: put it last inside the <form> so the
// submit button stays part of the form (Enter submits).
export function ModalFooter({ children }) {
  return <div className="modal-foot">{children}</div>;
}
