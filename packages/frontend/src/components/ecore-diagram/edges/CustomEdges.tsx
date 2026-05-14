/**
 * @emf-webapp/frontend — Custom Edge Components for Ecore Diagram Editor
 *
 * Sigue las convenciones visuales del editor de diagramas .ecore de Eclipse:
 *
 *   referenceEdge  → línea sólida, punta de flecha (▶) en el TARGET
 *                    etiqueta del nombre de la referencia cerca del SOURCE
 *                    cardinalidad [lower..upper] cerca del TARGET
 *
 *   containmentEdge → línea sólida, diamante relleno (◆) en el SOURCE
 *                    + punta de flecha (▶) en el TARGET
 *                    etiqueta del nombre cerca del SOURCE
 *
 *   inheritanceEdge → línea discontinua, triángulo hueco (△) en el TARGET (padre)
 *                    sin etiqueta (convención UML)
 *
 * Colores: modo oscuro/claro mediante CSS variables (var(--text), var(--border), etc.)
 */
import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { EcoreEdgeData } from '../types';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** Formatea la cardinalidad estilo UML: [0..1], [*], [1], [0..*] */
function formatCardinality(lowerBound: number, upperBound: number): string {
  const lo = `${lowerBound}`;
  const hi = upperBound === -1 ? '*' : `${upperBound}`;
  if (lo === hi && upperBound !== -1) return `[${lo}]`;
  return `[${lo}..${hi}]`;
}

/** Color del texto/cardinalidad según el tipo de edge */
function edgeColors(type: string) {
  switch (type) {
    case 'containmentEdge':
      return { stroke: 'var(--primary)', text: 'var(--primary)', bg: 'var(--primary-bg)', diamond: 'var(--primary)' };
    default:
      return { stroke: 'var(--border)', text: 'var(--text-secondary)', bg: 'var(--surface)', diamond: '' };
  }
}

/** Renderiza el label combinado (refName + cardinalidad) para edge reference/containment */
function renderCombinedLabel(
  label: string,
  cardinality: string,
  labelX: number,
  labelY: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  colors: { bg: string; text: string; border: string },
) {
  const combined = cardinality ? `${label} ${cardinality}` : label;
  // Posición: 60% del camino desde source hacia target (ligeramente más cerca del source)
  const px = labelX * 0.6 + sourceX * 0.4;
  const py = labelY * 0.6 + sourceY * 0.4;
  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${px}px,${py}px)`,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 4,
          padding: '1px 6px',
          fontSize: 11,
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          color: colors.text,
          zIndex: 10,
        }}
      >
        {combined}
      </div>
    </EdgeLabelRenderer>
  );
}

const ARROW_MARKER = (id: string, color: string) => (
  <marker
    key={`arrow-${id}`}
    id={`arrow-${id}`}
    viewBox="0 0 12 12"
    refX="10"
    refY="6"
    markerWidth="10"
    markerHeight="10"
    orient="auto"
  >
    <path d="M 1 1 L 11 6 L 1 11 Z" fill={color} />
  </marker>
);

/** SVG marker: diamante relleno (◆) para composición/containment */
const DIAMOND_MARKER = (id: string, color: string) => (
  <marker
    key={`diamond-${id}`}
    id={`diamond-${id}`}
    viewBox="0 0 14 14"
    refX="14"
    refY="7"
    markerWidth="12"
    markerHeight="12"
    orient="auto"
  >
    <polygon points="7,0 14,7 7,14 0,7" fill={color} stroke={color} strokeWidth={1} />
  </marker>
);

/** SVG marker: triángulo hueco (△) para herencia */
const HOLLOW_TRIANGLE = (id: string, color: string) => (
  <marker
    key={`hollow-${id}`}
    id={`hollow-${id}`}
    viewBox="0 0 14 14"
    refX="12"
    refY="7"
    markerWidth="12"
    markerHeight="12"
    orient="auto"
  >
    <polygon points="2,1 12,7 2,13" fill="transparent" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
  </marker>
);

// ─────────────────────────────────────────────────────────────────
// 1. ReferenceEdge — Eclipse Ecore Tools convention
//
//    ─────────────▶
//   source        target
//   (refName)
//   [lower..upper]
// ─────────────────────────────────────────────────────────────────

function ReferenceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const {
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
    data, selected,
  } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const ref = data?.reference;
  const label = data?.label || '';
  const colors = edgeColors('referenceEdge');
  const cardinality = ref ? formatCardinality(ref.lowerBound, ref.upperBound) : '';

  return (
    <>
      <defs>
        {ARROW_MARKER(id, colors.stroke)}
      </defs>

      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: colors.stroke,
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          transition: 'opacity 0.15s',
          opacity: selected ? 0.85 : 1,
        }}
        markerEnd={`url(#arrow-${id})`}
      />

      {renderCombinedLabel(label, cardinality, labelX, labelY, sourceX, sourceY, targetX, targetY, colors)}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// 2. ContainmentEdge — Eclipse Ecore Tools convention
//
//    ◆─────────────▶
//   source        target
//   (refName)
//   [0..*]
// ─────────────────────────────────────────────────────────────────

function ContainmentEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const {
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
    data, selected,
  } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const ref = data?.reference;
  const label = data?.label || '';
  const colors = edgeColors('containmentEdge');
  const cardinality = ref ? formatCardinality(ref.lowerBound, ref.upperBound) : '';

  return (
    <>
      <defs>
        {DIAMOND_MARKER(id, colors.diamond)}
        {ARROW_MARKER(id, colors.stroke)}
      </defs>

      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: colors.stroke,
          strokeWidth: 2,
          strokeLinecap: 'round',
          transition: 'opacity 0.15s',
          opacity: selected ? 0.85 : 1,
        }}
        markerStart={`url(#diamond-${id})`}
        markerEnd={`url(#arrow-${id})`}
      />

      {renderCombinedLabel(label, cardinality, labelX, labelY, sourceX, sourceY, targetX, targetY, colors)}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// 3. InheritanceEdge — Eclipse Ecore Tools convention
//
//    - - - - - - - △
//   child          parent
// ─────────────────────────────────────────────────────────────────

function InheritanceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const {
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
    selected,
  } = props;

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const color = 'var(--text-muted)';

  return (
    <>
      <defs>
        {HOLLOW_TRIANGLE(id, color)}
      </defs>

      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: color,
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeDasharray: '6 4',
          transition: 'opacity 0.15s',
          opacity: selected ? 0.8 : 0.6,
        }}
        markerEnd={`url(#hollow-${id})`}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Edge type registry
// ─────────────────────────────────────────────────────────────────

export const edgeTypes = {
  referenceEdge: ReferenceEdge,
  containmentEdge: ContainmentEdge,
  inheritanceEdge: InheritanceEdge,
};
