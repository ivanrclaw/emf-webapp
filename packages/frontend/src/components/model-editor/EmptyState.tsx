/**
 * @emf-webapp/frontend — EmptyState
 *
 * Shown when the model has no objects. Provides a visual CTA
 * to guide the user to start creating elements.
 */

interface EmptyStateProps {
  hasSpec: boolean;
  onCreateFirst?: () => void;
}

export function EmptyState({ hasSpec, onCreateFirst }: EmptyStateProps) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      pointerEvents: 'none',
      zIndex: 5,
    }}>
      {/* Illustration */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 16,
        background: 'var(--surface, #1e1e2e)',
        border: '2px dashed var(--border, #27272a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.6,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #71717a)" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <circle cx="17.5" cy="17.5" r="3.5" />
          <line x1="17.5" y1="15.5" x2="17.5" y2="19.5" />
          <line x1="15.5" y1="17.5" x2="19.5" y2="17.5" />
        </svg>
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text, #e4e4e7)',
          marginBottom: 6,
        }}>
          {hasSpec ? 'Empty Model' : 'No Viewpoint Specification'}
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted, #71717a)',
          lineHeight: 1.5,
        }}>
          {hasSpec
            ? 'Use the palette on the left or drag tools onto the canvas to create your first model element.'
            : 'Create a Viewpoint Specification in the Spec Editor to define what elements can be created.'}
        </div>
      </div>

      {/* CTA */}
      {hasSpec && onCreateFirst && (
        <button
          onClick={onCreateFirst}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid var(--primary, #6366f1)',
            borderRadius: 6,
            background: 'rgba(99,102,241,0.1)',
            color: 'var(--primary, #6366f1)',
            cursor: 'pointer',
            pointerEvents: 'all',
            transition: 'background 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
        >
          + Create First Element
        </button>
      )}

      {/* Keyboard hints */}
      <div style={{
        display: 'flex',
        gap: 12,
        fontSize: 10,
        color: 'var(--text-muted, #71717a)',
        opacity: 0.7,
      }}>
        <span>Drag from palette</span>
        <span>·</span>
        <span>Click + in corner</span>
        <span>·</span>
        <span>Click tool to create</span>
      </div>
    </div>
  );
}
