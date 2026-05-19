import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Vertical resizable panel — drag handle on top or bottom.
 * Mirror of ResizablePanel but for height.
 */

interface ResizablePanelVProps {
  children: React.ReactNode;
  /** Which edge holds the drag handle. 'top' = panel below the handle (e.g. bottom dock). */
  direction: 'top' | 'bottom';
  defaultHeight: number;
  minHeight: number;
  maxHeight: number;
  storageKey?: string;
  style?: React.CSSProperties;
  onResize?: (height: number) => void;
}

function getInitialHeight(
  storageKey: string | undefined,
  defaultHeight: number,
  minHeight: number,
  maxHeight: number
): number {
  if (storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          return Math.min(maxHeight, Math.max(minHeight, parsed));
        }
      }
    } catch {
      /* localStorage unavailable */
    }
  }
  return defaultHeight;
}

export function ResizablePanelV({
  children,
  direction,
  defaultHeight,
  minHeight,
  maxHeight,
  storageKey,
  style,
  onResize,
}: ResizablePanelVProps) {
  const [height, setHeight] = useState(() =>
    getInitialHeight(storageKey, defaultHeight, minHeight, maxHeight)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
    },
    [height]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - dragStartY.current;
      // top handle: dragging up grows the panel (multiplier -1)
      // bottom handle: dragging down grows the panel (multiplier 1)
      const multiplier = direction === 'top' ? -1 : 1;
      const newHeight = Math.min(
        maxHeight,
        Math.max(minHeight, dragStartHeight.current + delta * multiplier)
      );
      setHeight(newHeight);
      onResizeRef.current?.(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(height));
        } catch {
          /* localStorage unavailable */
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, minHeight, maxHeight, storageKey, height]);

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    zIndex: 10,
    cursor: 'row-resize',
    background: isDragging
      ? 'color-mix(in srgb, var(--primary) 60%, transparent)'
      : isHovered
        ? 'color-mix(in srgb, var(--primary) 30%, transparent)'
        : 'transparent',
    transition: 'background 150ms',
    ...(direction === 'top' ? { top: 0 } : { bottom: 0 }),
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height,
    ...style,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    cursor: 'row-resize',
    background: 'transparent',
  };

  return (
    <div style={containerStyle}>
      <div
        style={handleStyle}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={minHeight}
        aria-valuemax={maxHeight}
      />
      {children}
      {isDragging && <div style={overlayStyle} />}
    </div>
  );
}

export default ResizablePanelV;
