import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { toUserErrorMessage } from '../utils/errorMessage';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, options = {}) => {
      const id = ++toastId;
      const tone = options.tone || 'info';
      const duration = options.duration ?? 4000;
      setToasts((prev) => [...prev.slice(-4), { id, message, tone }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const showError = useCallback(
    (error, fallback) => {
      return showToast(toUserErrorMessage(error, fallback), { tone: 'error' });
    },
    [showToast],
  );

  const showSuccess = useCallback(
    (message) => showToast(message, { tone: 'success' }),
    [showToast],
  );

  const value = useMemo(
    () => ({ showToast, showError, showSuccess, dismiss }),
    [showToast, showError, showSuccess, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
              toast.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/80 dark:text-red-200'
                : toast.tone === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/80 dark:text-green-200'
                  : 'border-border bg-card text-heading'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-relaxed">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-xs opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
