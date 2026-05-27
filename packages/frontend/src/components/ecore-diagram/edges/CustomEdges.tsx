/**
 * @emf-webapp/frontend — Custom Edge Components for Ecore Diagram Editor
 *
 * Minimal edge rendering using React Flow's getSmoothStepPath.
 * Port spreading: edges sharing the same (node, side) are spread along
 * that side so their horizontal/vertical segments don't overlap.
 *
 * Self-loops use computeSelfLoopPath since React Flow can't handle them.
 *
 * referenceEdge   → solid line, arrowhead (▶) at TARGET
 * containmentEdge → solid line, filled diamond (◆) at SOURCE + arrow TARGET
 * inheritanceEdge → dashed line, hollow triangle (△) at TARGET
 */
import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { EcoreEdgeData } from '../types';
import { computeSelfLoopPath } from '../../../lib/edge-routing';

// ─────────────────────────────────────────────────────────────────
// Port spreading
// ─────────────────────────────────────────────────────────────────

const PORT_SPACING = 20; // px between adjacent ports on the same side

/**
 * Compute the offset for a port along a node side.
 * For left/right sides → Y offset. For top/bottom → X offset.
 */
function portOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  const span = PORT_SPACING * (total - 1);
  return -span / 2 + index * PORT_SPACING;
}

/**
 * Apply port spreading to a coordinate along the node side.
 */
function applySpread(
  x: number, y: number,
  position: Position,
  portIndex: number,
  portTotal: number,
): { x: number; y: number } {
  const offset = portOffset(portIndex, portTotal);
  switch (position) {
    case Position.Left:
    case Position.Right:
      return { x, y: y + offset };
    case Position.Top:
    case Position.Bottom:
      return { x: x + offset, y };
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function formatCardinality(lowerBound: number, upperBound: number): string {
  const lo = `${lowerBound}`;
  const hi = upperBound === -1 ? '*' : `${upperBound}`;
  if (lo === hi && upperBound !== -1) return `[${lo}]`;
  return `[${lo}..${hi}]`;
}

function edgeColors(type: string) {
  switch (type) {
    case 'containmentEdge':
      return { stroke: 'var(--primary)', text: 'var(--primary)', bg: 'var(--primary-bg)', border: 'var(--primary)', diamond: 'var(--primary)' };
    default:
      return { stroke: 'var(--border)', text: 'var(--text-secondary)', bg: 'var(--surface)', border: 'var(--border)', diamond: '' };
  }
}

function renderCombinedLabel(
  label: string,
  cardinality: string,
  labelX: number,
  labelY: number,
  colors: { bg: string; text: string; border: string },
) {
  const combined = cardinality ? `${label} ${cardinality}` : label;
  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
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

// ─────────────────────────────────────────────────────────────────
// Compute spread path — uses React Flow's stock getSmoothStepPath
// ─────────────────────────────────────────────────────────────────

function computeEdgePath(
  sourceX: number, sourceY: number, sourcePosition: Position,
  targetX: number, targetY: number, targetPosition: Position,
  data: EcoreEdgeData | undefined,
) {
  const pairTotal = data?.pairTotal ?? 1;
  const pairIndex = data?.pairIndex ?? 0;

  let src: { x: number; y: number };
  let tgt: { x: number; y: number };

  if (pairTotal > 1) {
    // Paired edges: use pairIndex as port index on BOTH sides to keep lines parallel
    src = applySpread(sourceX, sourceY, sourcePosition, pairIndex, pairTotal);
    tgt = applySpread(targetX, targetY, targetPosition, pairIndex, pairTotal);
  } else {
    // Single edge: use normal port spreading
    src = applySpread(sourceX, sourceY, sourcePosition, data?.sourcePortIndex ?? 0, data?.sourcePortTotal ?? 1);
    tgt = applySpread(targetX, targetY, targetPosition, data?.targetPortIndex ?? 0, data?.targetPortTotal ?? 1);
  }

  // Use React Flow's stock smooth step path for all edges
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: src.x,
    sourceY: src.y,
    sourcePosition,
    targetX: tgt.x,
    targetY: tgt.y,
    targetPosition,
    borderRadius: 8,
  });

  return [path, labelX, labelY] as [string, number, number];
}

// ─────────────────────────────────────────────────────────────────
// Marker definitions
// ─────────────────────────────────────────────────────────────────

const ARROW_MARKER = (id: string, color: string) => (
  <marker
    key={`arrow-${id}`}
    id={`arrow-${id}`}
    viewBox="0 0 12 12" refX="10" refY="6"
    markerWidth="10" markerHeight="10" orient="auto"
  >
    <path d="M 1 1 L 11 6 L 1 11 Z" fill={color} />
  </marker>
);

const DIAMOND_MARKER = (id: string, color: string) => (
  <marker
    key={`diamond-${id}`}
    id={`diamond-${id}`}
    viewBox="0 0 14 14" refX="7" refY="7"
    markerWidth="12" markerHeight="12" orient="auto-start-reverse"
  >
    <polygon points="7,0 14,7 7,14 0,7" fill={color} stroke={color} strokeWidth={1} />
  </marker>
);

const HOLLOW_TRIANGLE = (id: string, color: string) => (
  <marker
    key={`hollow-${id}`}
    id={`hollow-${id}`}
    viewBox="0 0 14 14" refX="12" refY="7"
    markerWidth="12" markerHeight="12" orient="auto"
  >
    <polygon points="2,1 12,7 2,13" fill="transparent" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
  </marker>
);

// ─────────────────────────────────────────────────────────────────
// Edge components
// ─────────────────────────────────────────────────────────────────

function ReferenceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;

  // Self-loop detection
  if (data?.sourceId && data?.targetId && data.sourceId === data.targetId) {
    const nodeWidth = 180;
    const nodeHeight = 140;
    const nodeX = sourceX - nodeWidth / 2;
    const nodeY = sourceY - nodeHeight / 2;
    const [edgePath, labelX, labelY] = computeSelfLoopPath(
      nodeX, nodeY, nodeWidth, nodeHeight, 0, 1,
    );
    const ref = data?.reference;
    const label = data?.label || '';
    const colors = edgeColors('referenceEdge');
    const cardinality = ref ? formatCardinality(ref.lowerBound, ref.upperBound) : '';

    return (
      <>
        <defs>{ARROW_MARKER(id, colors.stroke)}</defs>
        <BaseEdge
          path={edgePath}
          interactionWidth={20}
          style={{
            stroke: colors.stroke, strokeWidth: 1.5, strokeLinecap: 'round',
            opacity: selected ? 0.85 : 1,
          }}
          markerEnd={`url(#arrow-${id})`}
        />
        {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
      </>
    );
  }

  const [path, labelX, labelY] = computeEdgePath(
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    data,
  );

  const ref = data?.reference;
  const label = data?.label || '';
  const colors = edgeColors('referenceEdge');
  const cardinality = ref ? formatCardinality(ref.lowerBound, ref.upperBound) : '';

  return (
    <>
      <defs>{ARROW_MARKER(id, colors.stroke)}</defs>
      <BaseEdge
        path={path}
        interactionWidth={20}
        style={{
          stroke: colors.stroke, strokeWidth: 1.5, strokeLinecap: 'round',
          opacity: selected ? 0.85 : 1,
        }}
        markerEnd={`url(#arrow-${id})`}
      />
      {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
    </>
  );
}

function ContainmentEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;

  // Self-loop detection
  if (data?.sourceId && data?.targetId && data.sourceId === data.targetId) {
    const nodeWidth = 180;
    const nodeHeight = 140;
    const nodeX = sourceX - nodeWidth / 2;
    const nodeY = sourceY - nodeHeight / 2;
    const [edgePath, labelX, labelY] = computeSelfLoopPath(
      nodeX, nodeY, nodeWidth, nodeHeight, 0, 1,
    );
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
            stroke: colors.stroke, strokeWidth: 2, strokeLinecap: 'round',
            opacity: selected ? 0.85 : 1,
          }}
          markerStart={`url(#diamond-${id})`}
          markerEnd={`url(#arrow-${id})`}
        />
        {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
      </>
    );
  }

  const [path, labelX, labelY] = computeEdgePath(
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    data,
  );

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
        path={path}
        interactionWidth={20}
        style={{
          stroke: colors.stroke, strokeWidth: 2, strokeLinecap: 'round',
          opacity: selected ? 0.85 : 1,
        }}
        markerStart={`url(#diamond-${id})`}
        markerEnd={`url(#arrow-${id})`}
      />
      {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
    </>
  );
}

function InheritanceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;

  // Self-loop makes no sense for inheritance — skip
  if (data?.sourceId && data?.targetId && data.sourceId === data.targetId) {
    return null;
  }

  const [path] = computeEdgePath(
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    data,
  );

  const color = 'var(--text-muted)';

  return (
    <>
      <defs>{HOLLOW_TRIANGLE(id, color)}</defs>
      <BaseEdge
        path={path}
        interactionWidth={20}
        style={{
          stroke: color, strokeWidth: 1.5, strokeLinecap: 'round',
          strokeDasharray: '6 4',
          opacity: selected ? 0.8 : 0.6,
        }}
        markerEnd={`url(#hollow-${id})`}
      />
    </>
  );
}

export const edgeTypes = {
  referenceEdge: ReferenceEdge,
  containmentEdge: ContainmentEdge,
  inheritanceEdge: InheritanceEdge,
};
