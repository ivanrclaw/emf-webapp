/**
 * EditorStatusBar — Bottom status bar for the Model Editor.
 *
 * Shows:
 * - Zoom level (clickable to reset)
 * - Object/edge counts
 * - Selection info
 * - Validation summary
 * - Grid snap indicator
 */
import React from 'react';
import { AlertTriangle, CircleX, Box, Link2, MousePointer2, Grid3X3 } from '../icons';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface EditorStatusBarProps {
  zoomLevel: number;
  onResetZoom: () => void;
  nodeCount: number;
  edgeCount: number;
  selectedName: string | null;
  selectedType: string | null;
  validationErrors: number;
  validationWarnings: number;
  showGrid: boolean;
  gridSize: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditorStatusBar({
  zoomLevel,
  onResetZoom,
  nodeCount,
  edgeCount,
  selectedName,
  selectedType,
  validationErrors,
  validationWarnings,
  showGrid,
  gridSize,
}: EditorStatusBarProps) {
  return (
    <div style={styles.bar}>
      {/* ─── Left: Zoom ─────────────────────────────────────────── */}
      <button
        onClick={onResetZoom}
        title="Reset zoom to 100%"
        style={styles.zoomBtn}
      >
        {Math.round(zoomLevel * 100)}%
      </button>

      <Dot />

      {/* ─── Counts ─────────────────────────────────────────────── */}
      <div style={styles.segment}>
        <Box size={11} style={{ color: 'var(--text-muted)' }} />
        <span style={styles.text}>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
        <Link2 size={11} style={{ color: 'var(--text-muted)', marginLeft: 6 }} />
        <span style={styles.text}>{edgeCount} edge{edgeCount !== 1 ? 's' : ''}</span>
      </div>

      <Dot />

      {/* ─── Selection ──────────────────────────────────────────── */}
      <div style={styles.segment}>
        <MousePointer2 size={11} style={{ color: 'var(--text-muted)' }} />
        {selectedName ? (
          <span style={styles.text}>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{selectedName}</span>
            {selectedType && (
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({selectedType})</span>
            )}
          </span>
        ) : (
          <span style={{ ...styles.text, fontStyle: 'italic' }}>No selection</span>
        )}
      </div>

      {/* ─── Spacer ─────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ─── Validation ─────────────────────────────────────────── */}
      {(validationErrors > 0 || validationWarnings > 0) && (
        <div style={styles.segment}>
          {validationErrors > 0 && (
            <span style={{ ...styles.badge, color: 'var(--error, #ef4444)' }}>
              <CircleX size={11} />
              {validationErrors}
            </span>
          )}
          {validationWarnings > 0 && (
            <span style={{ ...styles.badge, color: 'var(--warning, #f59e0b)' }}>
              <AlertTriangle size={11} />
              {validationWarnings}
            </span>
          )}
        </div>
      )}

      {/* ─── Grid ───────────────────────────────────────────────── */}
      {showGrid && (
        <div style={styles.segment}>
          <Grid3X3 size={11} style={{ color: 'var(--text-muted)' }} />
          <span style={styles.text}>{gridSize}px</span>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Dot() {
  return (
    <span style={{ color: 'var(--border)', fontSize: 8, margin: '0 6px' }}>●</span>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 12px',
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    minHeight: 26,
  },
  zoomBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 3,
    transition: 'background 0.1s',
  },
  segment: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 11,
    fontWeight: 500,
  },
};

export default EditorStatusBar;
