import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import Toast, { type ToastItem, type ToastType } from './Toast';

/* ───────── default durations per type ───────── */

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  error: 8000,
  success: 3000,
  warning: 5000,
  info: 4000,
};

/* ───────── context value shape ───────── */

export interface ToastContextValue {
  addToast: (
    message: string,
    type?: ToastType,
    options?: {
      duration?: number;
      details?: string;
      onRetry?: () => void;
      action?: { label: string; onClick: () => void };
    },
  ) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => '',
  removeToast: () => {},
  clearToasts: () => {},
});

/* ───────── hook ───────── */

export function useToast() {
  return useContext(ToastContext);
}

/* ───────── provider ───────── */

/** Wraps children and renders the toast notification overlay. */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      options?: {
        duration?: number;
        details?: string;
        onRetry?: () => void;
        action?: { label: string; onClick: () => void };
      },
    ) => {
      const id = `toast-${++counterRef.current}`;
      const duration =
        options?.duration !== undefined
          ? options.duration
          : DEFAULT_DURATIONS[type];

      const item: ToastItem = {
        id,
        message,
        type,
        duration,
        details: options?.details,
        onRetry: options?.onRetry,
        action: options?.action,
      };

      setToasts((prev) => [...prev, item]);
      return id;
    },
    [],
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, clearToasts }}>
      {children}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}
