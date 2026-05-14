/**
 * @emf-webapp/frontend — Toolbox Panel
 *
 * Panel lateral izquierdo con secciones para añadir clases, enums y data types.
 * Soporta drag & drop al canvas de React Flow.
 *
 * ⚠️  Sin Tailwind — todo style={} inline.
 */
import React, { useCallback, type DragEvent } from 'react';

// ── Types ───────────────────────────────────────────────────────

export interface ToolboxProps {
  /** Callback para añadir un classifier mediante botón */
  onAdd: (type: 'class' | 'enum' | 'dataType') => void;
}

// ── Drag data key ───────────────────────────────────────────────

export const DRAG_DATA_KEY = 'application/x-emf-classifier-type';

// ── Secciones ───────────────────────────────────────────────────

interface ToolboxSection {
  type: 'class' | 'enum' | 'dataType';
  label: string;
  icon: string;
  /** Valor para borderLeftColor (hex) */
  borderColor: string;
}

const SECTIONS: ToolboxSection[] = [
  { type: 'class', label: 'Clase', icon: '📦', borderColor: '#3b82f6' },    // blue-500
  { type: 'enum', label: 'Enum', icon: '📋', borderColor: '#22c55e' },     // green-500
  { type: 'dataType', label: 'DataType', icon: '🔤', borderColor: '#f59e0b' }, // amber-500
];

// ── Styles ──────────────────────────────────────────────────────

const styles = {
  // Outer panel
  panel: {
    width: 256,
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  // Header bar
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    background: 'linear-gradient(to right, #f9fafb, #fff)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
    margin: 0,
  },
  headerIcon: {
    width: 16,
    height: 16,
    color: '#6366f1', // indigo-500
    flexShrink: 0,
  },
  // Sections scrollable area
  sectionList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  // Group heading
  groupHeading: {
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 8,
    padding: '0 4px',
    margin: 0,
  },
  // Add button
  addBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    borderLeftWidth: 4,
    background: '#fff',
    fontSize: 13,
    color: '#374151',
    cursor: 'grab',
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
  },
  addBtnIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  addBtnLabel: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  // Hint at bottom
  hint: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center' as const,
    paddingTop: 8,
    borderTop: '1px solid #f3f4f6',
    margin: 0,
  },
} as const;

// ── Component ───────────────────────────────────────────────────

export const Toolbox: React.FC<ToolboxProps> = ({ onAdd }) => {
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, type: 'class' | 'enum' | 'dataType') => {
      e.dataTransfer.setData(DRAG_DATA_KEY, type);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>
          <svg style={styles.headerIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Toolbox
        </h2>
      </div>

      {/* Sections */}
      <div style={styles.sectionList}>
        {SECTIONS.map((section) => (
          <div key={section.type}>
            {/* Section header */}
            <h3 style={styles.groupHeading}>
              {section.label}s
            </h3>

            {/* Add button */}
            <button
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, section.type)}
              onClick={() => onAdd(section.type)}
              style={{
                ...styles.addBtn,
                borderLeftColor: section.borderColor,
              }}
            >
              <span style={styles.addBtnIcon}>{section.icon}</span>
              <span style={styles.addBtnLabel}>
                Añadir {section.label}
              </span>
            </button>
          </div>
        ))}

        {/* Hint text */}
        <p style={styles.hint}>
          Arrastra al canvas o haz clic para añadir
        </p>
      </div>
    </div>
  );
};

export default Toolbox;
