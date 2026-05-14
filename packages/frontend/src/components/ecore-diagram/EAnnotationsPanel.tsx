/**
 * @emf-webapp/frontend — EAnnotations Panel
 *
 * Panel/cuadro expandible para gestionar anotaciones EMF (EAnnotations).
 * Cada anotación tiene un source URI y una tabla de pares clave-valor (details).
 */
import React, { useCallback } from 'react';
import type { SerializableAnnotation } from './types';

// ── Types ───────────────────────────────────────────────────────

export interface EAnnotationsPanelProps {
  /** Lista de anotaciones actuales (puede ser undefined) */
  annotations?: SerializableAnnotation[];
  /** Callback cuando se modifica la lista de anotaciones */
  onAnnotationsChange: (annotations: SerializableAnnotation[]) => void;
}

// ── Generar ID única para clave-valor ───────────────────────────

let _detailIdCounter = 0;
function genDetailId(): string {
  return `detail_${Date.now()}_${++_detailIdCounter}`;
}

// ── Componente de par clave-valor individual ────────────────────

interface DetailRowProps {
  keyName: string;
  value: string;
  onChange: (key: string, value: string) => void;
  onRemove: () => void;
}

const DetailRow: React.FC<DetailRowProps> = ({ keyName, value, onChange, onRemove }) => (
  <div className="flex items-center gap-1.5 group">
    <input
      type="text"
      value={keyName}
      onChange={(e) => onChange(e.target.value, value)}
      placeholder="Key"
      className="flex-[2] min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 rounded
                 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                 bg-white font-mono"
    />
    <span className="text-gray-300 flex-shrink-0">=</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(keyName, e.target.value)}
      placeholder="Value"
      className="flex-[3] min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 rounded
                 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                 bg-white font-mono"
    />
    <button
      type="button"
      onClick={onRemove}
      className="flex-shrink-0 p-0.5 text-gray-300 hover:text-red-500
                 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Remove detail"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

// ── Componente de anotación individual ──────────────────────────

interface AnnotationCardProps {
  annotation: SerializableAnnotation;
  index: number;
  onChange: (index: number, ann: SerializableAnnotation) => void;
  onRemove: (index: number) => void;
}

const AnnotationCard: React.FC<AnnotationCardProps> = ({ annotation, index, onChange, onRemove }) => {
  const detailsEntries = Object.entries(annotation.details);

  const handleSourceChange = useCallback(
    (source: string) => {
      onChange(index, { ...annotation, source });
    },
    [index, annotation, onChange],
  );

  const handleDetailChange = useCallback(
    (oldKey: string, newKey: string, newValue: string) => {
      const newDetails = { ...annotation.details };
      // Si la clave cambió, eliminar la antigua y añadir la nueva
      if (oldKey !== newKey) {
        delete newDetails[oldKey];
      }
      newDetails[newKey] = newValue;
      onChange(index, { ...annotation, details: newDetails });
    },
    [index, annotation, onChange],
  );

  const handleRemoveDetail = useCallback(
    (key: string) => {
      const newDetails = { ...annotation.details };
      delete newDetails[key];
      onChange(index, { ...annotation, details: newDetails });
    },
    [index, annotation, onChange],
  );

  const handleAddDetail = useCallback(() => {
    const newDetails = { ...annotation.details };
    newDetails[`key${Object.keys(newDetails).length + 1}`] = '';
    onChange(index, { ...annotation, details: newDetails });
  }, [index, annotation, onChange]);

  return (
    <div className="border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">Annotation #{index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-xs text-red-500 hover:text-red-700 font-medium
                     px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Source URI */}
      <div className="px-3 py-2 border-b border-gray-200">
        <label className="block text-xs font-medium text-gray-500 mb-1">Source URI</label>
        <input
          type="text"
          value={annotation.source}
          onChange={(e) => handleSourceChange(e.target.value)}
          placeholder="http:///org/eclipse/emf/..."
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded
                     focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                     bg-white font-mono"
        />
      </div>

      {/* Details */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-500">Details</label>
          <button
            type="button"
            onClick={handleAddDetail}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium
                       px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
          >
            + Add Detail
          </button>
        </div>

        {detailsEntries.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No details defined</p>
        ) : (
          <div className="space-y-1">
            {detailsEntries.map(([key, val]) => (
              <DetailRow
                key={key}
                keyName={key}
                value={val}
                onChange={(newKey, newVal) => handleDetailChange(key, newKey, newVal)}
                onRemove={() => handleRemoveDetail(key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────

export const EAnnotationsPanel: React.FC<EAnnotationsPanelProps> = ({
  annotations = [],
  onAnnotationsChange,
}) => {
  const handleAnnotationChange = useCallback(
    (index: number, updated: SerializableAnnotation) => {
      const newAnnotations = annotations.map((a, i) => (i === index ? updated : a));
      onAnnotationsChange(newAnnotations);
    },
    [annotations, onAnnotationsChange],
  );

  const handleRemoveAnnotation = useCallback(
    (index: number) => {
      const newAnnotations = annotations.filter((_, i) => i !== index);
      onAnnotationsChange(newAnnotations);
    },
    [annotations, onAnnotationsChange],
  );

  const handleAddAnnotation = useCallback(() => {
    const newAnnotation: SerializableAnnotation = {
      source: '',
      details: {},
    };
    onAnnotationsChange([...annotations, newAnnotation]);
  }, [annotations, onAnnotationsChange]);

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Annotations</span>
          {annotations.length > 0 && (
            <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
              {annotations.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddAnnotation}
          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700
                     px-3 py-1.5 rounded transition-colors shadow-sm"
        >
          + Add Annotation
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {annotations.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            <p className="text-sm">No annotations</p>
            <p className="text-xs mt-1">Click "Add Annotation" to create one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {annotations.map((ann, idx) => (
              <AnnotationCard
                key={idx}
                annotation={ann}
                index={idx}
                onChange={handleAnnotationChange}
                onRemove={handleRemoveAnnotation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EAnnotationsPanel;
