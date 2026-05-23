/**
 * AlignmentToolbar — Contextual toolbar for multi-node alignment operations.
 *
 * Appears below the main toolbar when 2+ nodes are selected.
 * Provides alignment, distribution, and auto-layout actions.
 *
 * Groups:
 * - Align: Left, Center, Right, Top, Middle, Bottom
 * - Distribute: Horizontal, Vertical (requires 3+ nodes)
 * - Auto Layout: Tree, Force, Grid
 */
import React from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Rows3,
  Columns3,
  LayoutGrid,
  TreePine,
  Waypoints,
} from '../icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeDirection = 'horizontal' | 'vertical';
export type LayoutAlgorithm = 'tree' | 'force' | 'grid';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AlignmentToolbarProps {
  visible: boolean;
  selectionCount: number;
  onAlign: (direction: AlignDirection) => void;
  onDistribute: (direction: DistributeDirection) => void;
  onAutoLayout: (algorithm: LayoutAlgorithm) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlignmentToolbar({
  visible,
  selectionCount,
  onAlign,
  onDistribute,
  onAutoLayout,
}: AlignmentToolbarProps) {
  if (!visible) return null;

  const distributeDisabled = selectionCount < 3;

  return (
    <div style={styles.toolbar} role="toolbar" aria-label="Alignment toolbar">
      {/* ─── Align Group ──────────────────────────────────────────── */}
      <div style={styles.group}>
        <ToolbarButton
          icon={<AlignLeft size={14} />}
          title="Align Left"
          onClick={() => onAlign('left')}
        />
        <ToolbarButton
          icon={<AlignCenter size={14} />}
          title="Align Center"
          onClick={() => onAlign('center')}
        />
        <ToolbarButton
          icon={<AlignRight size={14} />}
          title="Align Right"
          onClick={() => onAlign('right')}
        />
        <ToolbarButton
          icon={<AlignStartVertical size={14} />}
          title="Align Top"
          onClick={() => onAlign('top')}
        />
        <ToolbarButton
          icon={<AlignCenterVertical size={14} />}
          title="Align Middle"
          onClick={() => onAlign('middle')}
        />
        <ToolbarButton
          icon={<AlignEndVertical size={14} />}
          title="Align Bottom"
          onClick={() => onAlign('bottom')}
        />
      </div>

      <Separator />

      {/* ─── Distribute Group ─────────────────────────────────────── */}
      <div style={styles.group}>
        <ToolbarButton
          icon={<Columns3 size={14} />}
          title="Distribute Horizontal"
          onClick={() => onDistribute('horizontal')}
          disabled={distributeDisabled}
        />
        <ToolbarButton
          icon={<Rows3 size={14} />}
          title="Distribute Vertical"
          onClick={() => onDistribute('vertical')}
          disabled={distributeDisabled}
        />
      </div>

      <Separator />

      {/* ─── Auto Layout Group ────────────────────────────────────── */}
      <div style={styles.group}>
        <ToolbarButton
          icon={<TreePine size={14} />}
          title="Auto Layout: Tree"
          onClick={() => onAutoLayout('tree')}
        />
        <ToolbarButton
          icon={<Waypoints size={14} />}
          title="Auto Layout: Force"
          onClick={() => onAutoLayout('force')}
        />
        <ToolbarButton
          icon={<LayoutGrid size={14} />}
          title="Auto Layout: Grid"
          onClick={() => onAutoLayout('grid')}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToolbarButton({
  icon,
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        ...styles.iconBtn,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return <div style={styles.separator} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    height: 36,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  separator: {
    width: 1,
    height: 20,
    background: 'var(--border)',
    margin: '0 4px',
    flexShrink: 0,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background 0.1s, color 0.1s',
  },
};

export default AlignmentToolbar;
