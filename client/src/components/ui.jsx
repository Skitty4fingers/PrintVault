// Shared UI primitives: inline SVG icons, spinner, empty/error states,
// modal + confirm dialog, and a toast notification system.
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

/* ---- Icons (inline SVG, no dependency) ----------------------------------- */
const PATHS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  library: 'M4 6h16M4 12h16M4 18h16',
  upload: 'M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  collection: 'M3 7h7l2 2h9v9a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2h1z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 13a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 01-4 0v-.1A1.7 1.7 0 005 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003.6 14H3.5a2 2 0 010-4h.1A1.7 1.7 0 005 7.6l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3.6V3.5a2 2 0 014 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9z',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z',
  grid: 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M5 21h14',
  share: 'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4m0 0L8 6m4-4v13',
  trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  close: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  back: 'M19 12H5m0 0l7 7m-7-7l7-7',
  menu: 'M3 6h18M3 12h18M3 18h18',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  check: 'M20 6L9 17l-5-5',
  box: 'M21 8l-9-5-9 5 9 5 9-5zm0 0v8l-9 5-9-5V8',
  lock: 'M5 11h14v10H5V11zm2 0V7a5 5 0 0110 0v4',
  database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zm8 6c0 1.7-3.6 3-8 3s-8-1.3-8-3m16 6c0 1.7-3.6 3-8 3s-8-1.3-8-3M4 6v12m16-12v12',
  heart: 'M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 10-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 000-7.1z',
};

export function Icon({ name, size = 19, fill = false, className = '' }) {
  const d = PATHS[name] || PATHS.box;
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}

export function Spinner({ size = 30 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}
export function CenterSpinner() {
  return <div className="center-spin"><Spinner /></div>;
}

export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="state">
      <div className="ico-big">{icon}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state">
      <div className="ico-big">⚠️</div>
      <h3>Something went wrong</h3>
      <p>{message || 'Failed to load. Please try again.'}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton skel-card" />)}
    </div>
  );
}

/* ---- Modal & confirm ------------------------------------------------------ */
export function Modal({ title, children, onClose, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmText = 'Confirm', danger, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
      </>}>
      <p style={{ margin: 0, color: 'var(--muted)' }}>{message}</p>
    </Modal>
  );
}

/* ---- Toasts --------------------------------------------------------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '⛔' : 'ℹ️'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
