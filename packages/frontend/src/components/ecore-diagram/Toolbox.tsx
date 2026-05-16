/**
 * @emf-webapp/frontend — Toolbox Panel
 *
 * Panel lateral izquierdo con secciones para añadir clases, enums y data types.
 * Soporta drag & drop al canvas de React Flow.
 *
 * Sin Tailwind — todo style={} inline con CSS variables.
 */
import React, { useCallback, type DragEvent, type ReactNode } from 'react';
import { Box, List, Hash } from '../icons';

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
  icon: ReactNode;
  /** Valor para borderLeftColor (hex) */
  borderColor: string;
}

const SECTIONS: ToolboxSection[] = [
  { type: 'class', label: 'Clase', icon: <Box size={18} style={{ color: '#6366f1' }} />, borderColor: '#6366f1' },
  { type: 'enum', label: 'Enum', icon: <List size={18} style={{ color: '#fb923c' }} />, borderColor: '#fb923c' },
  { type: 'dataType', label: 'DataType', icon: <Hash size={18} style={{ color: '#9ca3af' }} />, borderColor: '#9ca3af' },
];

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
    <div
      style={{
        width: 256,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <h2
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            textTransform: 'uppercase',
            letterSpacing: '0.025em',
            margin: 0,
          }}
        >
          <svg
            style={{ width: 16, height: 16, color: 'var(--primary)', flexShrink: 0 }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Toolbox
        </h2>
      </div>

      {/* Sections */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {SECTIONS.map((section) => (
          <div key={section.type}>
            {/* Section header */}
            <h3
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
                padding: '0 4px',
                margin: 0,
              }}
            >
              {section.label}s
            </h3>

            {/* Add button */}
            <button
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, section.type)}
              onClick={() => onAdd(section.type)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                borderLeftWidth: 4,
                borderLeftColor: section.borderColor,
                background: 'var(--surface)',
                fontSize: 13,
                color: 'var(--text)',
                cursor: 'grab',
                boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
              }}
            >
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{section.icon}</span>
              <span
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Añadir {section.label}
              </span>
            </button>
          </div>
        ))}

        {/* Hint text */}
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            paddingTop: 8,
            borderTop: '1px solid var(--border-light)',
            margin: 0,
          }}
        >
          Arrastra al canvas o haz clic para añadir
        </p>
      </div>
    </div>
  );
};

export default Toolbox;
