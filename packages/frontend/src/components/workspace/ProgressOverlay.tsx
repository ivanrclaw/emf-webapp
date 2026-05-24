import React from 'react';

interface ProgressOverlayProps {
  visible: boolean;
  message: string;
  progress?: number;
  indeterminate?: boolean;
}

const keyframesStyle = `
@keyframes progress-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes progress-indeterminate {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(0%); }
  100% { transform: translateX(200%); }
}
`;

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  visible,
  message,
  progress,
  indeterminate,
}) => {
  const isDeterminate = progress !== undefined && !indeterminate;
  const clampedProgress = isDeterminate ? Math.min(100, Math.max(0, progress)) : undefined;

  return (
    <>
      <style>{keyframesStyle}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
        aria-hidden={!visible}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '32px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            minWidth: '280px',
            maxWidth: '400px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Spinner */}
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'progress-spin 0.8s linear infinite',
            }}
          />

          {/* Message */}
          <p
            style={{
              margin: 0,
              color: 'var(--text)',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            {message}
          </p>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              role="progressbar"
              aria-valuenow={clampedProgress ?? undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={message}
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: 'var(--border)',
                borderRadius: '3px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {isDeterminate ? (
                <div
                  style={{
                    height: '100%',
                    width: `${clampedProgress}%`,
                    backgroundColor: 'var(--primary)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    width: '40%',
                    backgroundColor: 'var(--primary)',
                    borderRadius: '3px',
                    animation: 'progress-indeterminate 1.5s ease-in-out infinite',
                  }}
                />
              )}
            </div>

            {isDeterminate && (
              <span
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  textAlign: 'center',
                }}
              >
                {Math.round(clampedProgress!)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
