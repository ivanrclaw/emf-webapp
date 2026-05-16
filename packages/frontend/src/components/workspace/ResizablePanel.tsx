import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  direction: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
  style?: React.CSSProperties;
  onResize?: (width: number) => void;
}

function getInitialWidth(
  storageKey: string | undefined,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number
): number {
  if (storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          return Math.min(maxWidth, Math.max(minWidth, parsed));
        }
      }
    } catch {
      // localStorage unavailable
    }
  }
  return defaultWidth;
}

export function ResizablePanel({
  children,
  direction,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  style,
  onResize,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() =>
    getInitialWidth(storageKey, defaultWidth, minWidth, maxWidth)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const onResizeRef = useRef(onResize);

  // Keep callback ref current without triggering effects
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
    },
    [width]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      // When handle is on the right, dragging right increases width
      // When handle is on the left, dragging left increases width
      const multiplier = direction === 'right' ? 1 : -1;
      const newWidth = Math.min(
        maxWidth,
        Math.max(minWidth, dragStartWidth.current + delta * multiplier)
      );
      setWidth(newWidth);
      onResizeRef.current?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(width));
        } catch {
          // localStorage unavailable
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, minWidth, maxWidth, storageKey, width]);

  // Save width to localStorage on drag end (captured via the latest width in state)
  // The mouseup handler above already does this.

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 10,
    cursor: 'col-resize',
    background: isDragging
      ? 'color-mix(in srgb, var(--primary) 60%, transparent)'
      : isHovered
        ? 'color-mix(in srgb, var(--primary) 30%, transparent)'
        : 'transparent',
    transition: 'background 150ms',
    ...(direction === 'right' ? { right: 0 } : { left: 0 }),
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexShrink: 0,
    width,
    ...style,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    cursor: 'col-resize',
    background: 'transparent',
  };

  return (
    <div style={containerStyle}>
      {children}
      <div
        style={handleStyle}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
      />
      {isDragging && <div style={overlayStyle} />}
    </div>
  );
}

export default ResizablePanel;
