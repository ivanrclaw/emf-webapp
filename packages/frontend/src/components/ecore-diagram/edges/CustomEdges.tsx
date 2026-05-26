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

const PORT_SPACING = 30; // px between adjacent ports on the same side
const PAIR_OFFSET_SPACING = 24; // px between mid-segments of edges in the same node pair

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
// Compute spread path
// ─────────────────────────────────────────────────────────────────

/**
 * Custom smooth step path that supports shifting the vertical middle segment.
 * React Flow's getSmoothStepPath offset only extends horizontal stubs,
 * it does NOT move the vertical corridor. We need our own implementation.
 */
function customSmoothStepPath(
  sourceX: number, sourceY: number, sourcePosition: Position,
  targetX: number, targetY: number, targetPosition: Position,
  corridorOffset: number,
  borderRadius: number,
): [string, number, number] {
  const isHorizontal = (sourcePosition === Position.Left || sourcePosition === Position.Right) &&
                       (targetPosition === Position.Left || targetPosition === Position.Right);
  const isVertical = (sourcePosition === Position.Top || sourcePosition === Position.Bottom) &&
                     (targetPosition === Position.Top || targetPosition === Position.Bottom);

  if (isHorizontal) {
    // Horizontal connection: path goes H → V → H
    // The vertical segment X is at the midpoint + corridorOffset
    const midX = (sourceX + targetX) / 2 + corridorOffset;
    const r = Math.min(borderRadius, Math.abs(midX - sourceX) / 2, Math.abs(targetX - midX) / 2, Math.abs(targetY - sourceY) / 2);

    if (Math.abs(targetY - sourceY) < 1) {
      // Straight horizontal line
      const labelX = (sourceX + targetX) / 2;
      const labelY = sourceY;
      return [`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`, labelX, labelY];
    }

    const dirS = sourcePosition === Position.Right ? 1 : -1;
    const dirT = targetPosition === Position.Left ? -1 : 1;
    const startX = sourceX;
    const endX = targetX;

    // Build path: source → horizontal to midX → vertical to targetY → horizontal to target
    const dy = targetY > sourceY ? 1 : -1;
    const path = buildSmoothStepH(startX, sourceY, midX, targetY, endX, r, dy, dirS, dirT);
    const labelX = midX;
    const labelY = (sourceY + targetY) / 2;
    return [path, labelX, labelY];
  } else if (isVertical) {
    // Vertical connection: path goes V → H → V
    const midY = (sourceY + targetY) / 2 + corridorOffset;
    const r = Math.min(borderRadius, Math.abs(midY - sourceY) / 2, Math.abs(targetY - midY) / 2, Math.abs(targetX - sourceX) / 2);

    if (Math.abs(targetX - sourceX) < 1) {
      const labelX = sourceX;
      const labelY = (sourceY + targetY) / 2;
      return [`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`, labelX, labelY];
    }

    const dirS = sourcePosition === Position.Bottom ? 1 : -1;
    const dirT = targetPosition === Position.Top ? -1 : 1;
    const dx = targetX > sourceX ? 1 : -1;
    const path = buildSmoothStepV(sourceX, sourceY, targetX, midY, targetY, r, dx, dirS, dirT);
    const labelX = (sourceX + targetX) / 2;
    const labelY = midY;
    return [path, labelX, labelY];
  } else {
    // Mixed (e.g., Right→Top): fall back to getSmoothStepPath
    const result = getSmoothStepPath({
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
      borderRadius,
    });
    return [result[0], result[1], result[2]];
  }
}

/** Build H→V→H path with rounded corners */
function buildSmoothStepH(
  sx: number, sy: number, mx: number, ty: number, tx: number,
  r: number, dy: number, _dirS: number, _dirT: number,
): string {
  const rr = Math.min(r, Math.abs(mx - sx), Math.abs(ty - sy), Math.abs(tx - mx)) || 0;
  if (rr < 0.5) {
    return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
  }

  // First corner: horizontal to vertical
  const c1x = mx - (mx > sx ? rr : -rr);
  const c1y = sy + dy * rr;
  // Second corner: vertical to horizontal
  const c2x = mx + (tx > mx ? rr : -rr);
  const c2y = ty - dy * rr;

  return [
    `M ${sx} ${sy}`,
    `L ${c1x} ${sy}`,
    `Q ${mx} ${sy} ${mx} ${c1y}`,
    `L ${mx} ${c2y}`,
    `Q ${mx} ${ty} ${c2x} ${ty}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}

/** Build V→H→V path with rounded corners */
function buildSmoothStepV(
  sx: number, sy: number, tx: number, my: number, ty: number,
  r: number, dx: number, _dirS: number, _dirT: number,
): string {
  const rr = Math.min(r, Math.abs(my - sy), Math.abs(tx - sx), Math.abs(ty - my)) || 0;
  if (rr < 0.5) {
    return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
  }

  const c1x = sx + dx * rr;
  const c1y = my - (my > sy ? rr : -rr);
  const c2x = tx - dx * rr;
  const c2y = my + (ty > my ? rr : -rr);

  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${c1y}`,
    `Q ${sx} ${my} ${c1x} ${my}`,
    `L ${c2x} ${my}`,
    `Q ${tx} ${my} ${tx} ${c2y}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}

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
    // Paired edges (bidirectional between same nodes):
    // Use pairIndex as port index on BOTH sides to keep lines parallel.
    // Independent sourcePortIndex/targetPortIndex would cause X-crossings
    // because the edges are registered in different order on each side.
    src = applySpread(sourceX, sourceY, sourcePosition, pairIndex, pairTotal);
    tgt = applySpread(targetX, targetY, targetPosition, pairIndex, pairTotal);
  } else {
    // Single edge: use normal port spreading
    src = applySpread(sourceX, sourceY, sourcePosition, data?.sourcePortIndex ?? 0, data?.sourcePortTotal ?? 1);
    tgt = applySpread(targetX, targetY, targetPosition, data?.targetPortIndex ?? 0, data?.targetPortTotal ?? 1);
  }

  // Corridor offset: separate the vertical mid-segments of paired edges horizontally
  let corridorOffset = 0;
  if (pairTotal > 1) {
    const span = PAIR_OFFSET_SPACING * (pairTotal - 1);
    corridorOffset = -span / 2 + pairIndex * PAIR_OFFSET_SPACING;
  }

  return customSmoothStepPath(
    src.x, src.y, sourcePosition,
    tgt.x, tgt.y, targetPosition,
    corridorOffset, 8,
  );
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
