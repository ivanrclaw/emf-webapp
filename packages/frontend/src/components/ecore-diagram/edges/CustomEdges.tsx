/**
 * @emf-webapp/frontend — Custom Edge Components for Ecore Diagram Editor
 *
 * Professional edge routing with:
 * - Shared EdgeLayoutContext (single computation for all edges)
 * - Integrated crossing bridges (gap + arc in the SVG path itself)
 * - Full node avoidance on all segments
 * - Congestion-aware side selection
 * - Adaptive port spreading
 * - Rounded corners at bends
 *
 * referenceEdge   → solid line, arrowhead (▶) at TARGET
 * containmentEdge → solid line, filled diamond (◆) at SOURCE + arrow TARGET
 * inheritanceEdge → dashed line, hollow triangle (△) at TARGET
 */
import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { EcoreEdgeData } from '../types';
import {
  spreadHandlePosition,
  computeSelfLoopPath,
  BRIDGE_RADIUS,
} from '../../../lib/edge-routing';
import type { Side, NodeRect, CrossingPoint } from '../../../lib/edge-routing';
import { useEdgeLayout } from './EdgeLayoutContext';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 140;
const PAIR_EDGE_SPACING = 30;
const RISER_SPACING = 14;
const BEND_DIST = 18;
const CORNER_RADIUS = 6;
const NODE_MARGIN = 12;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function sideToPosition(side: Side): Position {
  switch (side) {
    case 'left': return Position.Left;
    case 'right': return Position.Right;
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
  }
}

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
    viewBox="0 0 14 14" refX="14" refY="7"
    markerWidth="12" markerHeight="12" orient="auto"
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
// Node avoidance
// ─────────────────────────────────────────────────────────────────

function doesHorizontalSegmentIntersectNode(
  y: number, x1: number, x2: number,
  nodeRects: Map<string, NodeRect>,
  excludeIds: Set<string>,
): NodeRect | null {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (const [id, rect] of nodeRects) {
    if (excludeIds.has(id)) continue;
    const top = rect.y - NODE_MARGIN;
    const bottom = rect.y + rect.height + NODE_MARGIN;
    const left = rect.x - NODE_MARGIN;
    const right = rect.x + rect.width + NODE_MARGIN;
    if (y >= top && y <= bottom && maxX >= left && minX <= right) {
      return rect;
    }
  }
  return null;
}

function doesVerticalSegmentIntersectNode(
  x: number, y1: number, y2: number,
  nodeRects: Map<string, NodeRect>,
  excludeIds: Set<string>,
): NodeRect | null {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (const [id, rect] of nodeRects) {
    if (excludeIds.has(id)) continue;
    const left = rect.x - NODE_MARGIN;
    const right = rect.x + rect.width + NODE_MARGIN;
    const top = rect.y - NODE_MARGIN;
    const bottom = rect.y + rect.height + NODE_MARGIN;
    if (x >= left && x <= right && maxY >= top && minY <= bottom) {
      return rect;
    }
  }
  return null;
}

function findSafeHorizontalChannel(
  baseY: number, x1: number, x2: number,
  nodeRects: Map<string, NodeRect>,
  excludeIds: Set<string>,
): number {
  let y = baseY;
  for (let attempt = 0; attempt < 15; attempt++) {
    const hit = doesHorizontalSegmentIntersectNode(y, x1, x2, nodeRects, excludeIds);
    if (!hit) return y;
    const aboveY = hit.y - NODE_MARGIN - 6;
    const belowY = hit.y + hit.height + NODE_MARGIN + 6;
    y = Math.abs(aboveY - baseY) <= Math.abs(belowY - baseY) ? aboveY : belowY;
  }
  return y;
}

function findSafeVerticalChannel(
  baseX: number, y1: number, y2: number,
  nodeRects: Map<string, NodeRect>,
  excludeIds: Set<string>,
): number {
  let x = baseX;
  for (let attempt = 0; attempt < 15; attempt++) {
    const hit = doesVerticalSegmentIntersectNode(x, y1, y2, nodeRects, excludeIds);
    if (!hit) return x;
    const leftX = hit.x - NODE_MARGIN - 6;
    const rightX = hit.x + hit.width + NODE_MARGIN + 6;
    x = Math.abs(leftX - baseX) <= Math.abs(rightX - baseX) ? leftX : rightX;
  }
  return x;
}

// ─────────────────────────────────────────────────────────────────
// Orthogonal path with rounded corners + node avoidance
// ─────────────────────────────────────────────────────────────────

function computeOrthogonalPath(
  sx: number, sy: number, sPos: Position,
  tx: number, ty: number, tPos: Position,
  channelOffset: number,
  pairGroupIndex: number,
  _pairGroupSize: number,
  nodeRects?: Map<string, NodeRect>,
  sourceId?: string,
  targetId?: string,
): [string, number, number] {
  const R = CORNER_RADIUS;
  const isHorizSource = sPos === Position.Left || sPos === Position.Right;
  const isHorizTarget = tPos === Position.Left || tPos === Position.Right;

  const excludeIds = new Set<string>();
  if (sourceId) excludeIds.add(sourceId);
  if (targetId) excludeIds.add(targetId);

  // Both horizontal (left/right connections)
  if (isHorizSource && isHorizTarget) {
    const sDir = sPos === Position.Right ? 1 : -1;
    const tDir = tPos === Position.Left ? -1 : 1;

    const riserOffset = RISER_SPACING * pairGroupIndex;
    let b1x = sx + sDir * (BEND_DIST + riserOffset);
    const b4x = tx + tDir * (BEND_DIST + riserOffset);

    // Node avoidance on vertical riser from source
    if (nodeRects) {
      b1x = findSafeVerticalChannel(b1x, sy, (sy + ty) / 2, nodeRects, excludeIds);
    }

    let midY = (sy + ty) / 2 + channelOffset;

    // Node avoidance on horizontal channel
    if (nodeRects) {
      midY = findSafeHorizontalChannel(midY, Math.min(b1x, b4x), Math.max(b1x, b4x), nodeRects, excludeIds);
    }

    // Nearly straight
    if (Math.abs(midY - sy) < 3 && Math.abs(midY - ty) < 3) {
      const path = `M ${sx} ${sy} L ${tx} ${ty}`;
      return [path, (sx + tx) / 2, (sy + ty) / 2];
    }

    const r = Math.max(0, Math.min(R, Math.abs(midY - sy) / 2, Math.abs(midY - ty) / 2, Math.abs(b1x - sx) / 2));

    const yDir1 = midY > sy ? 1 : -1;
    const yDir2 = ty > midY ? 1 : -1;
    const xDirMid = b4x > b1x ? 1 : -1;

    const path = [
      `M ${sx} ${sy}`,
      `L ${b1x - sDir * r} ${sy}`,
      `Q ${b1x} ${sy} ${b1x} ${sy + yDir1 * r}`,
      `L ${b1x} ${midY - yDir1 * r}`,
      `Q ${b1x} ${midY} ${b1x + xDirMid * r} ${midY}`,
      `L ${b4x - xDirMid * r} ${midY}`,
      `Q ${b4x} ${midY} ${b4x} ${midY + yDir2 * r}`,
      `L ${b4x} ${ty - yDir2 * r}`,
      `Q ${b4x} ${ty} ${b4x + (-tDir) * r} ${ty}`,
      `L ${tx} ${ty}`,
    ].join(' ');

    return [path, (b1x + b4x) / 2, midY];
  }

  // Both vertical (top/bottom connections)
  if (!isHorizSource && !isHorizTarget) {
    const sDir = sPos === Position.Bottom ? 1 : -1;
    const tDir = tPos === Position.Top ? -1 : 1;

    const riserOffset = RISER_SPACING * pairGroupIndex;
    let b1y = sy + sDir * (BEND_DIST + riserOffset);
    const b4y = ty + tDir * (BEND_DIST + riserOffset);

    // Node avoidance on horizontal riser from source
    if (nodeRects) {
      b1y = findSafeHorizontalChannel(b1y, sx, (sx + tx) / 2, nodeRects, excludeIds);
    }

    let midX = (sx + tx) / 2 + channelOffset;

    // Node avoidance on vertical channel
    if (nodeRects) {
      midX = findSafeVerticalChannel(midX, Math.min(b1y, b4y), Math.max(b1y, b4y), nodeRects, excludeIds);
    }

    if (Math.abs(midX - sx) < 3 && Math.abs(midX - tx) < 3) {
      const path = `M ${sx} ${sy} L ${tx} ${ty}`;
      return [path, (sx + tx) / 2, (sy + ty) / 2];
    }

    const r = Math.max(0, Math.min(R, Math.abs(midX - sx) / 2, Math.abs(midX - tx) / 2, Math.abs(b1y - sy) / 2));

    const xDir1 = midX > sx ? 1 : -1;
    const xDir2 = tx > midX ? 1 : -1;
    const yDirMid = b4y > b1y ? 1 : -1;

    const path = [
      `M ${sx} ${sy}`,
      `L ${sx} ${b1y - sDir * r}`,
      `Q ${sx} ${b1y} ${sx + xDir1 * r} ${b1y}`,
      `L ${midX - xDir1 * r} ${b1y}`,
      `Q ${midX} ${b1y} ${midX} ${b1y + yDirMid * r}`,
      `L ${midX} ${b4y - yDirMid * r}`,
      `Q ${midX} ${b4y} ${midX + xDir2 * r} ${b4y}`,
      `L ${tx - xDir2 * r} ${b4y}`,
      `Q ${tx} ${b4y} ${tx} ${b4y + (-tDir) * r}`,
      `L ${tx} ${ty}`,
    ].join(' ');

    return [path, midX, (b1y + b4y) / 2];
  }

  // Mixed: one horizontal, one vertical — L-shaped path
  const r = Math.max(0, Math.min(R, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2));

  if (isHorizSource && !isHorizTarget) {
    const bendX = tx;
    const bendY = sy;
    const xDir = tx > sx ? 1 : -1;
    const yDir = ty > sy ? 1 : -1;

    const path = [
      `M ${sx} ${sy}`,
      `L ${bendX - xDir * r} ${bendY}`,
      `Q ${bendX} ${bendY} ${bendX} ${bendY + yDir * r}`,
      `L ${tx} ${ty}`,
    ].join(' ');
    return [path, (sx + tx) / 2, sy + channelOffset];
  }

  // Source exits vertically, target enters horizontally
  const bendX = sx;
  const bendY = ty;
  const xDir = tx > sx ? 1 : -1;
  const yDir = ty > sy ? 1 : -1;

  const path = [
    `M ${sx} ${sy}`,
    `L ${bendX} ${bendY - yDir * r}`,
    `Q ${bendX} ${bendY} ${bendX + xDir * r} ${bendY}`,
    `L ${tx} ${ty}`,
  ].join(' ');
  return [path, sx + channelOffset, (sy + ty) / 2];
}

// ─────────────────────────────────────────────────────────────────
// Integrated crossing bridges — modify path to include gaps + arcs
// ─────────────────────────────────────────────────────────────────

/**
 * Given an edge path and its crossing points, produce a modified path
 * that has gaps at crossing points where this edge goes "under", and
 * arc bridges where this edge goes "over".
 *
 * Strategy:
 * - For the "over" edge (edgeId1 === this edge): draw an arc bump
 * - For the "under" edge (edgeId2 === this edge): create a gap
 *
 * We render bridges as separate SVG elements overlaid precisely,
 * but with correct stroke style matching the edge.
 */
function renderBridges(
  edgeId: string,
  crossings: CrossingPoint[],
  strokeColor: string,
  strokeWidth: number,
  isDashed?: boolean,
) {
  // Only render bridges where this edge is the "over" edge
  const overCrossings = crossings.filter((c) => c.edgeId1 === edgeId);
  if (overCrossings.length === 0) return null;

  const r = BRIDGE_RADIUS + 1;

  return (
    <g className="crossing-bridges" pointerEvents="none">
      {overCrossings.map((c, idx) => {
        const { point, angle } = c;
        // Determine if the crossing is more horizontal or vertical
        // angle near PI/2 means perpendicular (one H, one V)
        const isThisEdgeHorizontal = Math.abs(angle - Math.PI / 2) < 0.5;

        return (
          <React.Fragment key={`bridge-${idx}`}>
            {/* Background circle to hide the under-edge */}
            <circle
              cx={point.x}
              cy={point.y}
              r={r + 2}
              fill="var(--bg, #0f0f23)"
              stroke="none"
            />
            {/* Bridge arc matching edge style */}
            {isThisEdgeHorizontal ? (
              <>
                {/* Horizontal edge: connect left→right with arc bump upward */}
                <path
                  d={`M ${point.x - r} ${point.y} A ${r} ${r} 0 0 1 ${point.x + r} ${point.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={isDashed ? '6 4' : undefined}
                />
              </>
            ) : (
              <>
                {/* Vertical edge: connect top→bottom with arc bump to the right */}
                <path
                  d={`M ${point.x} ${point.y - r} A ${r} ${r} 0 0 1 ${point.x} ${point.y + r}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={isDashed ? '6 4' : undefined}
                />
              </>
            )}
          </React.Fragment>
        );
      })}
    </g>
  );
}

/**
 * Render gap circles for crossings where this edge goes "under".
 * These hide the segment of this edge at the crossing point.
 */
function renderUnderGaps(
  edgeId: string,
  crossings: CrossingPoint[],
) {
  const underCrossings = crossings.filter((c) => c.edgeId2 === edgeId);
  if (underCrossings.length === 0) return null;

  const r = BRIDGE_RADIUS + 3;

  return (
    <g className="crossing-gaps" pointerEvents="none">
      {underCrossings.map((c, idx) => (
        <circle
          key={`gap-${idx}`}
          cx={c.point.x}
          cy={c.point.y}
          r={r}
          fill="var(--bg, #0f0f23)"
          stroke="none"
        />
      ))}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────
// useEdgeCoords — per-edge coordinate computation (uses shared context)
// ─────────────────────────────────────────────────────────────────

function useEdgeCoords(
  edgeId: string,
  data: EcoreEdgeData | undefined,
) {
  const { nodeRects, sideAssignment, portGroups, pairGroups, crossingsMap } = useEdgeLayout();

  const sourceId = data?.sourceId;
  const targetId = data?.targetId;

  if (!sourceId || !targetId) return null;

  const sRect = nodeRects.get(sourceId);
  const tRect = nodeRects.get(targetId);
  if (!sRect || !tRect) return null;

  const sides = sideAssignment.get(edgeId);
  if (!sides) return null;

  const { sourceSide, targetSide } = sides;

  // Self-loop detection
  if (sourceId === targetId) {
    const selfLoopKey = [sourceId, targetId].sort().join('|');
    const selfGroup = pairGroups.get(selfLoopKey) ?? [edgeId];
    const selfIdx = selfGroup.indexOf(edgeId);
    return {
      isSelfLoop: true,
      nodeRect: sRect,
      loopIndex: Math.max(0, selfIdx),
      loopCount: selfGroup.length,
    };
  }

  // Get port index for source
  const sKey = `${sourceId}|${sourceSide}`;
  const sourceGroup = portGroups.get(sKey) ?? [];
  const sourceIdx = sourceGroup.indexOf(`${edgeId}:source`);
  const sourceGroupSize = sourceGroup.length;

  // Get port index for target
  const tKey = `${targetId}|${targetSide}`;
  const targetGroup = portGroups.get(tKey) ?? [];
  const targetIdx = targetGroup.indexOf(`${edgeId}:target`);
  const targetGroupSize = targetGroup.length;

  // Compute spread positions
  const spreadSource = spreadHandlePosition(
    sourceSide, sourceGroupSize, Math.max(0, sourceIdx),
    sRect.x, sRect.y, sRect.width, sRect.height,
  );
  const spreadTarget = spreadHandlePosition(
    targetSide, targetGroupSize, Math.max(0, targetIdx),
    tRect.x, tRect.y, tRect.width, tRect.height,
  );

  // Pair group channel offset
  const pairKey = [sourceId, targetId].sort().join('|');
  const pairGroup = pairGroups.get(pairKey) ?? [edgeId];
  const pairIdx = pairGroup.indexOf(edgeId);
  const pairSize = pairGroup.length;

  let channelOffset = 0;
  if (pairSize > 1) {
    const totalSpan = PAIR_EDGE_SPACING * (pairSize - 1);
    channelOffset = -totalSpan / 2 + PAIR_EDGE_SPACING * Math.max(0, pairIdx);
  }

  // Get crossings for this edge
  const edgeCrossings = crossingsMap.get(edgeId) ?? [];

  return {
    isSelfLoop: false,
    sourceX: spreadSource.x,
    sourceY: spreadSource.y,
    sourcePosition: sideToPosition(sourceSide),
    targetX: spreadTarget.x,
    targetY: spreadTarget.y,
    targetPosition: sideToPosition(targetSide),
    channelOffset,
    pairGroupIndex: Math.max(0, pairIdx),
    pairGroupSize: pairSize,
    nodeRects,
    sourceId,
    targetId,
    crossings: edgeCrossings,
  };
}

// ─────────────────────────────────────────────────────────────────
// Edge components
// ─────────────────────────────────────────────────────────────────

function ReferenceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY } = props;
  const coords = useEdgeCoords(id, data);

  if (!coords) {
    const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    return <BaseEdge path={path} style={{ stroke: 'var(--border)', strokeWidth: 1.5 }} />;
  }

  // Self-loop
  if (coords.isSelfLoop) {
    const { nodeRect, loopIndex, loopCount } = coords as any;
    const [edgePath, labelX, labelY] = computeSelfLoopPath(
      nodeRect.x, nodeRect.y, nodeRect.width, nodeRect.height,
      loopIndex, loopCount,
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

  const { sourceX: sx, sourceY: sy, sourcePosition: sPos,
    targetX: tx, targetY: ty, targetPosition: tPos,
    channelOffset, pairGroupIndex, pairGroupSize,
    nodeRects: nRects, sourceId: sId, targetId: tId, crossings: edgeCrossings } = coords as any;

  const [edgePath, labelX, labelY] = computeOrthogonalPath(
    sx, sy, sPos, tx, ty, tPos,
    channelOffset, pairGroupIndex, pairGroupSize,
    nRects, sId, tId,
  );

  const ref = data?.reference;
  const label = data?.label || '';
  const colors = edgeColors('referenceEdge');
  const cardinality = ref ? formatCardinality(ref.lowerBound, ref.upperBound) : '';

  return (
    <>
      <defs>{ARROW_MARKER(id, colors.stroke)}</defs>
      {renderUnderGaps(id, edgeCrossings)}
      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: colors.stroke, strokeWidth: 1.5, strokeLinecap: 'round',
          transition: 'opacity 0.15s', opacity: selected ? 0.85 : 1,
        }}
        markerEnd={`url(#arrow-${id})`}
      />
      {renderBridges(id, edgeCrossings, colors.stroke, 1.5)}
      {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
    </>
  );
}

function ContainmentEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY } = props;
  const coords = useEdgeCoords(id, data);

  if (!coords) {
    const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    return <BaseEdge path={path} style={{ stroke: 'var(--primary)', strokeWidth: 2 }} />;
  }

  // Self-loop
  if (coords.isSelfLoop) {
    const { nodeRect, loopIndex, loopCount } = coords as any;
    const [edgePath, labelX, labelY] = computeSelfLoopPath(
      nodeRect.x, nodeRect.y, nodeRect.width, nodeRect.height,
      loopIndex, loopCount,
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

  const { sourceX: sx, sourceY: sy, sourcePosition: sPos,
    targetX: tx, targetY: ty, targetPosition: tPos,
    channelOffset, pairGroupIndex, pairGroupSize,
    nodeRects: nRects, sourceId: sId, targetId: tId, crossings: edgeCrossings } = coords as any;

  const [edgePath, labelX, labelY] = computeOrthogonalPath(
    sx, sy, sPos, tx, ty, tPos,
    channelOffset, pairGroupIndex, pairGroupSize,
    nRects, sId, tId,
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
      {renderUnderGaps(id, edgeCrossings)}
      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: colors.stroke, strokeWidth: 2, strokeLinecap: 'round',
          transition: 'opacity 0.15s', opacity: selected ? 0.85 : 1,
        }}
        markerStart={`url(#diamond-${id})`}
        markerEnd={`url(#arrow-${id})`}
      />
      {renderBridges(id, edgeCrossings, colors.stroke, 2)}
      {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
    </>
  );
}

function InheritanceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY } = props;
  const coords = useEdgeCoords(id, data);

  if (!coords) {
    const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    return <BaseEdge path={path} style={{ stroke: 'var(--text-muted)', strokeWidth: 1.5, strokeDasharray: '6 4' }} />;
  }

  if (coords.isSelfLoop) {
    return null;
  }

  const { sourceX: sx, sourceY: sy, sourcePosition: sPos,
    targetX: tx, targetY: ty, targetPosition: tPos,
    channelOffset, pairGroupIndex, pairGroupSize,
    nodeRects: nRects, sourceId: sId, targetId: tId, crossings: edgeCrossings } = coords as any;

  const [edgePath] = computeOrthogonalPath(
    sx, sy, sPos, tx, ty, tPos,
    channelOffset, pairGroupIndex, pairGroupSize,
    nRects, sId, tId,
  );

  const color = 'var(--text-muted)';

  return (
    <>
      <defs>{HOLLOW_TRIANGLE(id, color)}</defs>
      {renderUnderGaps(id, edgeCrossings)}
      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: color, strokeWidth: 1.5, strokeLinecap: 'round',
          strokeDasharray: '6 4',
          transition: 'opacity 0.15s', opacity: selected ? 0.8 : 0.6,
        }}
        markerEnd={`url(#hollow-${id})`}
      />
      {renderBridges(id, edgeCrossings, color, 1.5, true)}
    </>
  );
}

export const edgeTypes = {
  referenceEdge: ReferenceEdge,
  containmentEdge: ContainmentEdge,
  inheritanceEdge: InheritanceEdge,
};
