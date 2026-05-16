import React, { useEffect, useRef } from 'react';
import { Loader2, X } from '../icons';

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  description?: string;
  progress?: { current: number; total: number } | null;
  cancellable?: boolean;
  onCancel?: () => void;
  children: React.ReactNode;
}

const spinKeyframes = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  message = 'Loading...',
  description,
  progress,
  cancellable = false,
  onCancel,
  children,
}) => {
  const styleTagRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!loading) return;
    if (typeof document === 'undefined') return;

    // Inject spin keyframes once
    if (!styleTagRef.current) {
      const style = document.createElement('style');
      style.textContent = spinKeyframes;
      document.head.appendChild(style);
      styleTagRef.current = style;
    }

    return () => {
      // Clean up on unmount
      if (styleTagRef.current) {
        styleTagRef.current.remove();
        styleTagRef.current = null;
      }
    };
  }, [loading]);

  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <div style={{ position: 'relative' }}>
      {children}

      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            borderRadius: 'var(--radius)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: 24,
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                color: 'var(--primary)',
                animation: 'spin 1s linear infinite',
              }}
            >
              <Loader2 width={24} height={24} />
            </div>

            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
                textAlign: 'center',
              }}
            >
              {message}
            </p>

            {description && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                {description}
              </p>
            )}

            {progress && (
              <div
                style={{
                  width: '100%',
                  minWidth: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    background: 'var(--border)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: 'var(--primary)',
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  {progress.current} / {progress.total}
                </span>
              </div>
            )}

            {cancellable && (
              <button
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                }}
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay;
