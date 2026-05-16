import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CircleX, CircleCheck, CircleAlert, Info, X, ChevronDown, Copy, RefreshCw } from '../icons';

interface ErrorToastAction {
  label: string;
  onClick: () => void;
}

interface ErrorToastProps {
  id: string;
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  details?: string;
  duration?: number;
  onRetry?: () => void;
  onDismiss: (id: string) => void;
  action?: ErrorToastAction;
}

const TYPE_CONFIG: Record<
  ErrorToastProps['type'],
  { borderColor: string; iconColor: string; stripColor: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }
> = {
  error: {
    borderColor: 'var(--danger)',
    iconColor: 'var(--danger)',
    stripColor: 'var(--danger)',
    Icon: CircleX,
  },
  success: {
    borderColor: 'var(--success)',
    iconColor: 'var(--success)',
    stripColor: 'var(--success)',
    Icon: CircleCheck,
  },
  warning: {
    borderColor: 'var(--warning)',
    iconColor: 'var(--warning)',
    stripColor: 'var(--warning)',
    Icon: CircleAlert,
  },
  info: {
    borderColor: 'var(--primary)',
    iconColor: 'var(--primary)',
    stripColor: 'var(--primary)',
    Icon: Info,
  },
};

const buttonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

const iconButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: '0 6px',
  minWidth: 28,
  justifyContent: 'center',
};

const ErrorToast: React.FC<ErrorToastProps> = ({
  id,
  type,
  message,
  details,
  duration = 5000,
  onRetry,
  onDismiss,
  action,
}) => {
  const { borderColor, iconColor, stripColor, Icon } = TYPE_CONFIG[type];
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [remaining, setRemaining] = useState(duration > 0 ? duration : 0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const isPersistent = duration === 0;

  // Enter animation on mount
  useEffect(() => {
    // Small delay so CSS transition fires
    const t = setTimeout(() => setVisible(true), 10);
    return () => {
      clearTimeout(t);
      mountedRef.current = false;
    };
  }, []);

  // Auto-dismiss countdown
  useEffect(() => {
    if (isPersistent) return;

    const startTime = Date.now();
    const tick = () => {
      if (!mountedRef.current) return;
      const elapsed = Date.now() - startTime;
      const rem = Math.max(0, duration - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        handleDismiss();
      }
    };

    countdownIntervalRef.current = setInterval(tick, 100);
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [duration, isPersistent]);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      if (mountedRef.current) {
        onDismiss(id);
      }
    }, 300);
  }, [id, onDismiss]);

  const handleCopy = useCallback(() => {
    const text = details ? `${message}\n\n${details}` : message;
    navigator.clipboard?.writeText(text).catch(() => {});
  }, [message, details]);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: 380,
    background: 'var(--surface)',
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    transform: visible ? 'translateX(0)' : 'translateX(100%)',
    opacity: exiting ? 0 : visible ? 1 : 0,
    marginBottom: 8,
  };

  const stripStyle: React.CSSProperties = {
    height: 3,
    background: stripColor,
    width: '100%',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '12px 40px 12px 14px',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  };

  const messageTextStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text)',
    lineHeight: 1.4,
    margin: 0,
    flex: 1,
  };

  const detailsPanelStyle: React.CSSProperties = {
    maxHeight: detailsOpen ? 200 : 0,
    overflow: 'hidden',
    transition: 'max-height 0.25s ease',
  };

  const detailsTextStyle: React.CSSProperties = {
    fontSize: 12,
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    background: 'var(--bg)',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.4,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 4,
    padding: 0,
  };

  const countdownStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 4,
    textAlign: 'right',
  };

  return (
    <div style={containerStyle} role="alert">
      <div style={stripStyle} />

      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          <div style={{ flexShrink: 0, width: 18, height: 18, color: iconColor, marginTop: 1 }}>
            <Icon width={18} height={18} />
          </div>
          <p style={messageTextStyle}>{message}</p>
        </div>

        {details && (
          <>
            <button
              style={{
                ...buttonStyle,
                border: 'none',
                background: 'none',
                padding: 0,
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 6,
                gap: 4,
              }}
              onClick={() => setDetailsOpen((v) => !v)}
            >
              <ChevronDown
                width={14}
                height={14}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
              {detailsOpen ? 'Hide details' : 'Show details'}
            </button>
            <div style={detailsPanelStyle}>
              <pre style={detailsTextStyle}>{details}</pre>
            </div>
          </>
        )}

        <div style={actionsStyle}>
          {action && (
            <button style={buttonStyle} onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {onRetry && (
            <button style={iconButtonStyle} onClick={onRetry} title="Retry">
              <RefreshCw width={14} height={14} />
              Retry
            </button>
          )}
          {details && (
            <button style={iconButtonStyle} onClick={handleCopy} title="Copy details">
              <Copy width={14} height={14} />
            </button>
          )}
        </div>

        {!isPersistent && !exiting && remaining > 0 && (
          <div style={countdownStyle}>
            Auto-dismiss in {Math.ceil(remaining / 1000)}s
          </div>
        )}
        {isPersistent && (
          <div style={countdownStyle}>Persistent</div>
        )}
      </div>

      <button style={closeButtonStyle} onClick={handleDismiss} title="Dismiss">
        <X width={14} height={14} />
      </button>
    </div>
  );
};

export default ErrorToast;
