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

/**
 * Build H→V→H path for paired edges sharing the same corridor X.
 * Since endpoints are at different Y (port spreading), horizontal segments
 * are parallel and the shared vertical corridor doesn't cause crossing.
 */
function buildParallelHVH(
  sx: number, sy: number, mx: number, tx: number, ty: number, r: number,
): string {
  const rr = Math.min(r, Math.abs(mx - sx), Math.abs(ty - sy), Math.abs(tx - mx)) || 0;
  const dy = ty > sy ? 1 : -1;
  if (rr < 0.5) {
    return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
  }
  const c1x = mx - (mx > sx ? rr : -rr);
  const c1y = sy + dy * rr;
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

/**
 * Build V→H→V path for paired edges sharing the same corridor Y.
 * Since endpoints are at different X (port spreading), vertical segments
 * are parallel and the shared horizontal corridor doesn't cause crossing.
 */
function buildParallelVHV(
  sx: number, sy: number, my: number, tx: number, ty: number, r: number,
): string {
  const rr = Math.min(r, Math.abs(my - sy), Math.abs(tx - sx), Math.abs(ty - my)) || 0;
  const dx = tx > sx ? 1 : -1;
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

  // For paired edges, compute a single canonical path and offset each edge
  // perpendicularly. This guarantees parallel non-crossing lines regardless
  // of node orientation (horizontal or vertical layout).
  if (pairTotal > 1) {
    // Canonical path uses the midpoint between the two spread endpoints
    const src0 = applySpread(sourceX, sourceY, sourcePosition, 0, pairTotal);
    const src1 = applySpread(sourceX, sourceY, sourcePosition, pairTotal - 1, pairTotal);
    const tgt0 = applySpread(targetX, targetY, targetPosition, 0, pairTotal);
    const tgt1 = applySpread(targetX, targetY, targetPosition, pairTotal - 1, pairTotal);
    const midSrc = { x: (src0.x + src1.x) / 2, y: (src0.y + src1.y) / 2 };
    const midTgt = { x: (tgt0.x + tgt1.x) / 2, y: (tgt0.y + tgt1.y) / 2 };

    // Compute the canonical H→V→H or V→H→V path segments
    const [canonPath, labelX, labelY] = customSmoothStepPath(
      midSrc.x, midSrc.y, sourcePosition,
      midTgt.x, midTgt.y, targetPosition,
      0, 0, // no offset, no rounding for the canonical reference
    );

    // Offset perpendicular to each segment
    const gap = PORT_SPACING;
    const offset = gap * (pairIndex - (pairTotal - 1) / 2);

    // Determine perpendicular direction based on orientation
    const isHorizontal = (sourcePosition === Position.Left || sourcePosition === Position.Right);

    if (isHorizontal) {
      // For paired bidirectional edges in horizontal layout:
      // Route as H→V→H→V→H (5 segments) so lines leave/arrive horizontally.
      // One edge goes ABOVE, the other BELOW to avoid crossing.
      const bypassOffset = PAIR_OFFSET_SPACING * 1.5 * (pairIndex === 0 ? -1 : 1);
      const bypassY = ((src.y + tgt.y) / 2) + bypassOffset;
      const r = 8;

      // Stub X: short horizontal segment out from source/target before turning vertical
      const stubLen = 20;
      const dirX = tgt.x > src.x ? 1 : -1;
      const stubSrcX = src.x + dirX * stubLen;
      const stubTgtX = tgt.x - dirX * stubLen;

      const rr = Math.min(r,
        Math.abs(stubSrcX - src.x),
        Math.abs(bypassY - src.y),
        Math.abs(stubTgtX - stubSrcX),
        Math.abs(tgt.y - bypassY),
        Math.abs(tgt.x - stubTgtX),
      ) || 0;

      if (rr < 0.5) {
        const path = `M ${src.x} ${src.y} L ${stubSrcX} ${src.y} L ${stubSrcX} ${bypassY} L ${stubTgtX} ${bypassY} L ${stubTgtX} ${tgt.y} L ${tgt.x} ${tgt.y}`;
        return [path, (src.x + tgt.x) / 2, bypassY] as [string, number, number];
      }

      const dy1 = bypassY > src.y ? 1 : -1;
      const dy2 = tgt.y > bypassY ? 1 : -1;

      const path = [
        `M ${src.x} ${src.y}`,
        `L ${stubSrcX - dirX * rr} ${src.y}`,
        `Q ${stubSrcX} ${src.y} ${stubSrcX} ${src.y + dy1 * rr}`,
        `L ${stubSrcX} ${bypassY - dy1 * rr}`,
        `Q ${stubSrcX} ${bypassY} ${stubSrcX + dirX * rr} ${bypassY}`,
        `L ${stubTgtX - dirX * rr} ${bypassY}`,
        `Q ${stubTgtX} ${bypassY} ${stubTgtX} ${bypassY + dy2 * rr}`,
        `L ${stubTgtX} ${tgt.y - dy2 * rr}`,
        `Q ${stubTgtX} ${tgt.y} ${stubTgtX + dirX * rr} ${tgt.y}`,
        `L ${tgt.x} ${tgt.y}`,
      ].join(' ');

      const lx = (src.x + tgt.x) / 2;
      const ly = bypassY;
      return [path, lx, ly] as [string, number, number];
    } else {
      // For paired bidirectional edges in vertical layout:
      // Route as V→H→V→H→V (5 segments) so lines leave/arrive vertically.
      // One edge goes LEFT, the other RIGHT to avoid crossing.
      const bypassOffset = PAIR_OFFSET_SPACING * 1.5 * (pairIndex === 0 ? -1 : 1);
      const bypassX = ((src.x + tgt.x) / 2) + bypassOffset;
      const r = 8;

      const stubLen = 20;
      const dirY = tgt.y > src.y ? 1 : -1;
      const stubSrcY = src.y + dirY * stubLen;
      const stubTgtY = tgt.y - dirY * stubLen;

      const rr = Math.min(r,
        Math.abs(stubSrcY - src.y),
        Math.abs(bypassX - src.x),
        Math.abs(stubTgtY - stubSrcY),
        Math.abs(tgt.x - bypassX),
        Math.abs(tgt.y - stubTgtY),
      ) || 0;

      if (rr < 0.5) {
        const path = `M ${src.x} ${src.y} L ${src.x} ${stubSrcY} L ${bypassX} ${stubSrcY} L ${bypassX} ${stubTgtY} L ${tgt.x} ${stubTgtY} L ${tgt.x} ${tgt.y}`;
        return [path, bypassX, (src.y + tgt.y) / 2] as [string, number, number];
      }

      const dx1 = bypassX > src.x ? 1 : -1;
      const dx2 = tgt.x > bypassX ? 1 : -1;

      const path = [
        `M ${src.x} ${src.y}`,
        `L ${src.x} ${stubSrcY - dirY * rr}`,
        `Q ${src.x} ${stubSrcY} ${src.x + dx1 * rr} ${stubSrcY}`,
        `L ${bypassX - dx1 * rr} ${stubSrcY}`,
        `Q ${bypassX} ${stubSrcY} ${bypassX} ${stubSrcY + dirY * rr}`,
        `L ${bypassX} ${stubTgtY - dirY * rr}`,
        `Q ${bypassX} ${stubTgtY} ${bypassX + dx2 * rr} ${stubTgtY}`,
        `L ${tgt.x - dx2 * rr} ${stubTgtY}`,
        `Q ${tgt.x} ${stubTgtY} ${tgt.x} ${stubTgtY + dirY * rr}`,
        `L ${tgt.x} ${tgt.y}`,
      ].join(' ');

      const lx = bypassX;
      const ly = (src.y + tgt.y) / 2;
      return [path, lx, ly] as [string, number, number];
    }
  }

  // Single edges: use custom H→V→H path
  return customSmoothStepPath(
    src.x, src.y, sourcePosition,
    tgt.x, tgt.y, targetPosition,
    0, 8,
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
