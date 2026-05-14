/**
 * @emf-webapp/frontend — Toolbox Panel
 *
 * Panel lateral izquierdo con secciones para añadir clases, enums y data types.
 * Soporta drag & drop al canvas de React Flow.
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
  color: string;
}

const SECTIONS: ToolboxSection[] = [
  { type: 'class', label: 'Clase', icon: '📦', color: 'border-l-blue-500' },
  { type: 'enum', label: 'Enum', icon: '📋', color: 'border-l-green-500' },
  { type: 'dataType', label: 'DataType', icon: '🔤', color: 'border-l-amber-500' },
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
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Toolbox
        </h2>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.type}>
            {/* Section header */}
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
              {section.label}s
            </h3>

            {/* Add button */}
            <button
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, section.type)}
              onClick={() => onAdd(section.type)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                border border-gray-200 border-l-4 ${section.color}
                bg-white text-sm text-gray-700
                hover:bg-gray-50 hover:border-gray-300
                active:bg-gray-100 active:scale-[0.98]
                transition-all duration-150 ease-in-out
                cursor-grab active:cursor-grabbing
                shadow-sm
              `}
            >
              <span className="text-lg flex-shrink-0">{section.icon}</span>
              <span className="font-medium truncate">
                Añadir {section.label}
              </span>
            </button>
          </div>
        ))}

        {/* Hint text */}
        <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
          Arrastra al canvas o haz clic para añadir
        </p>
      </div>
    </div>
  );
};

export default Toolbox;
