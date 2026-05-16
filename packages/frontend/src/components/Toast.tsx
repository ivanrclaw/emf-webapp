import { useState, useEffect, useRef, type CSSProperties } from 'react';
import {
  CircleX,
  CircleCheck,
  CircleAlert,
  Info,
  X,
  ChevronDown,
  RefreshCw,
} from './icons';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  details?: string;
  duration?: number; // ms, 0 = persistent
  onRetry?: () => void;
  action?: { label: string; onClick: () => void };
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

/* ───────── helpers ───────── */

const typeColor = (type: ToastType): string => {
  switch (type) {
    case 'error':
      return '#ef4444';
    case 'success':
      return '#22c55e';
    case 'warning':
      return '#f59e0b';
    case 'info':
      return '#3b82f6';
  }
};

const TypeIcon = ({ type }: { type: ToastType }) => {
  const size = 18;
  const color = typeColor(type);
  switch (type) {
    case 'error':
      return <CircleX size={size} color={color} />;
    case 'success':
      return <CircleCheck size={size} color={color} />;
    case 'warning':
      return <CircleAlert size={size} color={color} />;
    case 'info':
      return <Info size={size} color={color} />;
  }
};

/* ───────── single toast ───────── */

function ToastItemRow({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const startRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef<number>(0);

  const isPersistent = item.duration === 0;
  const durationMs = item.duration ?? 8000;

  // ── countdown ──
  useEffect(() => {
    if (isPersistent) return;

    const step = 50; // ms per tick
    const total = durationMs > 0 ? durationMs : 8000;
    remainingRef.current = total;
    startRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const rem = Math.max(0, total - elapsed);
      remainingRef.current = rem;
      setTimeLeft(rem);

      if (rem <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        onDismiss(item.id);
      }
    }, step);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, durationMs, isPersistent]);

  const borderColor = typeColor(item.type);
  const barWidth =
    isPersistent || timeLeft === null
      ? null
      : (timeLeft / durationMs) * 100;

  return (
    <div
      style={{
        ...styles.toast,
        borderLeft: `4px solid ${borderColor}`,
        animation: 'toastSlideIn 0.3s ease-out',
      }}
      role="alert"
    >
      {/* icon */}
      <div style={styles.iconCol}>
        <TypeIcon type={item.type} />
      </div>

      {/* content */}
      <div style={styles.bodyCol}>
        <div style={styles.messageRow}>
          <span style={styles.message}>{item.message}</span>
          <div style={styles.actions}>
            {item.onRetry && (
              <button
                style={styles.iconBtn}
                onClick={item.onRetry}
                title="Retry"
                aria-label="Retry"
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              style={styles.iconBtn}
              onClick={() => onDismiss(item.id)}
              title="Dismiss"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* details */}
        {item.details && (
          <div style={styles.detailsWrap}>
            <button
              style={styles.detailsToggle}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              <ChevronDown
                size={12}
                style={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
              <span style={{ fontSize: 12, marginLeft: 4 }}>Details</span>
            </button>
            {expanded && (
              <pre style={styles.detailsContent}>{item.details}</pre>
            )}
          </div>
        )}

        {/* action button */}
        {item.action && (
          <button
            style={{
              ...styles.actionBtn,
              borderColor,
              color: borderColor,
            }}
            onClick={item.action.onClick}
          >
            {item.action.label}
          </button>
        )}
      </div>

      {/* countdown bar */}
      {!isPersistent && barWidth !== null && (
        <div style={styles.barTrack}>
          <div
            style={{
              ...styles.barFill,
              width: `${barWidth}%`,
              backgroundColor: borderColor,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ───────── container ───────── */

/**
 * Toast notification list.
 *
 * Renders a fixed container top-right with slide-in animated toasts.
 */
export default function Toast({ toasts, onDismiss }: ToastProps) {
  if (!toasts.length) return null;

  return (
    <>
      {/* keyframe injection */}
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      <div style={styles.container}>
        {toasts.map((item) => (
          <ToastItemRow key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

/* ───────── styles ───────── */

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 400,
    width: '100%',
    pointerEvents: 'none',
  },
  toast: {
    position: 'relative',
    display: 'flex',
    gap: 10,
    padding: '12px 14px',
    paddingBottom: 10,
    borderRadius: 8,
    background: 'var(--toast-bg, #1e1e2e)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    pointerEvents: 'auto',
    overflow: 'hidden',
  },
  iconCol: {
    flexShrink: 0,
    paddingTop: 2,
  },
  bodyCol: {
    flex: 1,
    minWidth: 0,
  },
  messageRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 1.4,
    color: 'var(--toast-text, #e0e0e0)',
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--toast-muted, #888)',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s, color 0.15s',
  },
  detailsWrap: {
    marginTop: 6,
  },
  detailsToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    border: 'none',
    background: 'none',
    color: 'var(--toast-muted, #888)',
    cursor: 'pointer',
    padding: '2px 0',
    fontSize: 12,
  },
  detailsContent: {
    margin: '6px 0 0',
    padding: 8,
    borderRadius: 4,
    background: 'var(--toast-details-bg, rgba(255,255,255,0.06))',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--toast-muted, #aaa)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'auto',
    maxHeight: 200,
  },
  actionBtn: {
    marginTop: 8,
    padding: '5px 12px',
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid',
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  barTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'var(--toast-bar-track, rgba(255,255,255,0.08))',
  },
  barFill: {
    height: '100%',
    transition: 'width 0.05s linear',
    borderRadius: '0 0 0 8px',
  },
};
