import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import ReactDOM from 'react-dom';

export interface TooltipProps {
  /** Main label text */
  label: string;
  /** Optional keyboard shortcut hint (e.g. 'Ctrl+S') */
  shortcut?: string | null;
  /** Delay in ms before showing tooltip */
  delay?: number;
  /** The wrapped element */
  children: React.ReactNode;
}

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 99999,
  pointerEvents: 'none',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 11,
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  background: 'var(--text)',
  color: 'var(--bg)',
  border: '1px solid var(--border)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const shortcutStyle: React.CSSProperties = {
  opacity: 0.7,
};

const arrowStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -5,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: '5px solid var(--text)',
};

export function Tooltip({ label, shortcut, delay = 500, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
        setVisible(true);
      }
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const tooltipContent = visible && position ? (
    ReactDOM.createPortal(
      <div
        id={tooltipId}
        role="tooltip"
        style={{
          ...tooltipStyle,
          top: position.top,
          left: position.left,
          transform: 'translate(-50%, -100%)',
        }}
      >
        <span>{label}</span>
        {shortcut && (
          <span style={shortcutStyle}>({shortcut})</span>
        )}
        <span style={arrowStyle} aria-hidden="true" />
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={visible ? tooltipId : undefined}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </div>
      {tooltipContent}
    </>
  );
}

export default Tooltip;
