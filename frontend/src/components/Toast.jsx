import React, { useEffect } from 'react';

/**
 * Toast notification component.
 *
 * Usage (from a parent that manages toast state):
 *   <Toast message="Saved!" type="success" onClose={() => setToast(null)} />
 *
 * type: 'success' | 'error' | 'info' | 'warning'
 */
export default function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast--${type}`} role="alert">
      <span className="toast__icon">
        {type === 'success' && '✓'}
        {type === 'error'   && '✕'}
        {type === 'warning' && '⚠'}
        {type === 'info'    && 'ℹ'}
      </span>
      <span className="toast__message">{message}</span>
      <button className="toast__close" onClick={onClose} aria-label="Close">×</button>
    </div>
  );
}

/**
 * Hook to manage toast state conveniently.
 *
 * const { toast, showToast, clearToast } = useToast();
 */
export function useToast() {
  const [toast, setToast] = React.useState(null);

  const showToast = (message, type = 'info') => setToast({ message, type });
  const clearToast = () => setToast(null);

  return { toast, showToast, clearToast };
}
