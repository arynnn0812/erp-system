// Labelled form control. Field wires the label, hint and error to the control
// it wraps (htmlFor / aria-describedby / aria-invalid), so every input in the
// app is announced properly by screen readers without per-page bookkeeping.
import { Children, cloneElement, isValidElement, useId } from 'react';

// When the control is nested inside a wrapper (an input with a button),
// give the input an id and pass the same value as htmlFor.
export default function Field({ label, hint, error, optional = false, htmlFor, className = '', children }) {
  const generated = useId();
  const id = htmlFor || generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const child = Children.only(children);
  const control = isValidElement(child) && !htmlFor
    ? cloneElement(child, {
      id: child.props.id || id,
      'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : undefined,
    })
    : child;

  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={htmlFor || child.props?.id || id}>
        {label}{optional && <span className="optional"> (optional)</span>}
      </label>
      {control}
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  );
}
