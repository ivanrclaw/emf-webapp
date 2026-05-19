import { useIDEStore } from './useIDEStore';

export function StatusBar() {
  const { state } = useIDEStore();
  const { project, activeTab, diagnostics, autoSaveStatus } = state;

  const activeFile = project?.files.find((f) => f.id === activeTab);
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Status bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 22,
        padding: '0 12px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        fontSize: 11,
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      {/* Left: diagnostics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {errorCount > 0 && (
          <span style={{ color: 'var(--danger)', cursor: 'pointer' }} aria-label={`${errorCount} error${errorCount !== 1 ? 's' : ''}`}>
            ✕ {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span style={{ color: '#e5a100', cursor: 'pointer' }} aria-label={`${warningCount} warning${warningCount !== 1 ? 's' : ''}`}>
            ⚠ {warningCount}
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <span>No problems</span>
        )}
        {/* Screen reader announcement for diagnostics */}
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {errorCount} errors, {warningCount} warnings
        </span>
      </div>

      {/* Center: current file + auto-save status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeFile?.filename || ''}
        </span>
        {autoSaveStatus === 'saving' && (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }} aria-label="Saving files">
            Saving...
          </span>
        )}
        {autoSaveStatus === 'saved' && (
          <span style={{ color: 'var(--accent)', transition: 'opacity 0.3s' }} aria-label="All changes saved">
            Saved ✓
          </span>
        )}
      </div>

      {/* Right: language */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>Ln 1, Col 1</span>
        <span style={{ fontWeight: 500 }}>MTL</span>
      </div>
    </div>
  );
}
