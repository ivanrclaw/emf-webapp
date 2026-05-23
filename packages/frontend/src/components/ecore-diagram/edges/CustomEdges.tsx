/**
 * @emf-webapp/frontend — Custom Edge Components for Ecore Diagram Editor
 *
 * Professional edge routing with:
 * - Congestion-aware side selection (distributes edges evenly around nodes)
 * - Global channel assignment (prevents corridor overlaps)
 * - Self-loop handling (node → same node)
 * - Adaptive port spreading
 * - Rounded corners at bends
 *
 * referenceEdge   → solid line, arrowhead (▶) at TARGET
 * containmentEdge → solid line, filled diamond (◆) at SOURCE + arrow TARGET
 * inheritanceEdge → dashed line, hollow triangle (△) at TARGET
 */
import React, { useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useNodes,
  useEdges,
  type EdgeProps,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { EcoreEdgeData } from '../types';
import {
  spreadHandlePosition,
  computeGlobalSideAssignment,
  computeSelfLoopPath,
  detectCrossings,
} from '../../../lib/edge-routing';
import { CrossingBridges } from '../../shared/CrossingBridges';
import type { Side, NodeRect, CrossingPoint } from '../../../lib/edge-routing';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 140;
const PAIR_EDGE_SPACING = 30;
const RISER_SPACING = 14;
const BEND_DIST = 18;
const CORNER_RADIUS = 6;

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
// Node avoidance: shift channel if it intersects any node
// ─────────────────────────────────────────────────────────────────

const NODE_MARGIN = 12;

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
    const left = rect.x;
    const right = rect.x + rect.width;
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
    const top = rect.y;
    const bottom = rect.y + rect.height;
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
  for (let attempt = 0; attempt < 10; attempt++) {
    const hit = doesHorizontalSegmentIntersectNode(y, x1, x2, nodeRects, excludeIds);
    if (!hit) return y;
    // Shift above or below the blocking node
    const aboveY = hit.y - NODE_MARGIN - 4;
    const belowY = hit.y + hit.height + NODE_MARGIN + 4;
    y = Math.abs(aboveY - baseY) < Math.abs(belowY - baseY) ? aboveY : belowY;
  }
  return y;
}

function findSafeVerticalChannel(
  baseX: number, y1: number, y2: number,
  nodeRects: Map<string, NodeRect>,
  excludeIds: Set<string>,
): number {
  let x = baseX;
  for (let attempt = 0; attempt < 10; attempt++) {
    const hit = doesVerticalSegmentIntersectNode(x, y1, y2, nodeRects, excludeIds);
    if (!hit) return x;
    const leftX = hit.x - NODE_MARGIN - 4;
    const rightX = hit.x + hit.width + NODE_MARGIN + 4;
    x = Math.abs(leftX - baseX) < Math.abs(rightX - baseX) ? leftX : rightX;
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

  // Exclude source and target from node avoidance checks
  const excludeIds = new Set<string>();
  if (sourceId) excludeIds.add(sourceId);
  if (targetId) excludeIds.add(targetId);

  // Both horizontal (left/right connections) — most common
  if (isHorizSource && isHorizTarget) {
    const sDir = sPos === Position.Right ? 1 : -1;
    const tDir = tPos === Position.Left ? -1 : 1;

    const riserOffset = RISER_SPACING * pairGroupIndex;
    const b1x = sx + sDir * (BEND_DIST + riserOffset);
    const b4x = tx + tDir * (BEND_DIST + riserOffset);
    let midY = (sy + ty) / 2 + channelOffset;

    // Node avoidance: shift midY if it passes through a node
    if (nodeRects) {
      midY = findSafeHorizontalChannel(midY, Math.min(b1x, b4x), Math.max(b1x, b4x), nodeRects, excludeIds);
    }

    // Nearly straight — use direct path
    if (Math.abs(midY - sy) < 3 && Math.abs(midY - ty) < 3) {
      const path = `M ${sx} ${sy} L ${tx} ${ty}`;
      return [path, (sx + tx) / 2, (sy + ty) / 2];
    }

    const r = Math.min(R, Math.abs(midY - sy) / 2, Math.abs(midY - ty) / 2, Math.abs(b1x - sx) / 2);
    const rr = Math.max(r, 0);

    const yDir1 = midY > sy ? 1 : -1;
    const yDir2 = ty > midY ? 1 : -1;
    const xDirMid = b4x > b1x ? 1 : -1;

    const path = [
      `M ${sx} ${sy}`,
      `L ${b1x - sDir * rr} ${sy}`,
      `Q ${b1x} ${sy} ${b1x} ${sy + yDir1 * rr}`,
      `L ${b1x} ${midY - yDir1 * rr}`,
      `Q ${b1x} ${midY} ${b1x + xDirMid * rr} ${midY}`,
      `L ${b4x - xDirMid * rr} ${midY}`,
      `Q ${b4x} ${midY} ${b4x} ${midY + yDir2 * rr}`,
      `L ${b4x} ${ty - yDir2 * rr}`,
      `Q ${b4x} ${ty} ${b4x + (-tDir) * rr} ${ty}`,
      `L ${tx} ${ty}`,
    ].join(' ');

    return [path, (b1x + b4x) / 2, midY];
  }

  // Both vertical (top/bottom connections)
  if (!isHorizSource && !isHorizTarget) {
    const sDir = sPos === Position.Bottom ? 1 : -1;
    const tDir = tPos === Position.Top ? -1 : 1;

    const riserOffset = RISER_SPACING * pairGroupIndex;
    const b1y = sy + sDir * (BEND_DIST + riserOffset);
    const b4y = ty + tDir * (BEND_DIST + riserOffset);
    let midX = (sx + tx) / 2 + channelOffset;

    // Node avoidance: shift midX if it passes through a node
    if (nodeRects) {
      midX = findSafeVerticalChannel(midX, Math.min(b1y, b4y), Math.max(b1y, b4y), nodeRects, excludeIds);
    }

    if (Math.abs(midX - sx) < 3 && Math.abs(midX - tx) < 3) {
      const path = `M ${sx} ${sy} L ${tx} ${ty}`;
      return [path, (sx + tx) / 2, (sy + ty) / 2];
    }

    const r = Math.min(R, Math.abs(midX - sx) / 2, Math.abs(midX - tx) / 2, Math.abs(b1y - sy) / 2);
    const rr = Math.max(r, 0);

    const xDir1 = midX > sx ? 1 : -1;
    const xDir2 = tx > midX ? 1 : -1;
    const yDirMid = b4y > b1y ? 1 : -1;

    const path = [
      `M ${sx} ${sy}`,
      `L ${sx} ${b1y - sDir * rr}`,
      `Q ${sx} ${b1y} ${sx + xDir1 * rr} ${b1y}`,
      `L ${midX - xDir1 * rr} ${b1y}`,
      `Q ${midX} ${b1y} ${midX} ${b1y + yDirMid * rr}`,
      `L ${midX} ${b4y - yDirMid * rr}`,
      `Q ${midX} ${b4y} ${midX + xDir2 * rr} ${b4y}`,
      `L ${tx - xDir2 * rr} ${b4y}`,
      `Q ${tx} ${b4y} ${tx} ${b4y + (-tDir) * rr}`,
      `L ${tx} ${ty}`,
    ].join(' ');

    return [path, midX, (b1y + b4y) / 2];
  }

  // Mixed: one horizontal, one vertical — L-shaped path with one bend
  const r = Math.min(R, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2);
  const rr = Math.max(r, 0);

  if (isHorizSource && !isHorizTarget) {
    // Source exits horizontally, target enters vertically
    const bendX = tx;
    const bendY = sy;
    const xDir = tx > sx ? 1 : -1;
    const yDir = ty > sy ? 1 : -1;

    const path = [
      `M ${sx} ${sy}`,
      `L ${bendX - xDir * rr} ${bendY}`,
      `Q ${bendX} ${bendY} ${bendX} ${bendY + yDir * rr}`,
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
    `L ${bendX} ${bendY - yDir * rr}`,
    `Q ${bendX} ${bendY} ${bendX + xDir * rr} ${bendY}`,
    `L ${tx} ${ty}`,
  ].join(' ');
  return [path, sx + channelOffset, (sy + ty) / 2];
}

// ─────────────────────────────────────────────────────────────────
// useGlobalEdgeLayout — computes sides and channels for ALL edges
// ─────────────────────────────────────────────────────────────────

function useGlobalEdgeLayout() {
  const nodes = useNodes();
  const edges = useEdges();

  return useMemo(() => {
    // Build node rects
    const nodeRects = new Map<string, NodeRect>();
    nodes.forEach((n) => {
      const measured = (n as any)?.measured;
      nodeRects.set(n.id, {
        x: n.position.x,
        y: n.position.y,
        width: measured?.width ?? DEFAULT_NODE_WIDTH,
        height: measured?.height ?? DEFAULT_NODE_HEIGHT,
      });
    });

    // Build edge list with source/target IDs
    const edgeList = edges.map((e) => {
      const data = e.data as EcoreEdgeData | undefined;
      return {
        id: e.id,
        sourceId: data?.sourceId ?? e.source,
        targetId: data?.targetId ?? e.target,
      };
    });

    // Compute global side assignment
    const sideAssignment = computeGlobalSideAssignment(edgeList, nodeRects);

    // Compute unified port groups per (nodeId, side)
    const portGroups = new Map<string, string[]>(); // "nodeId|side" → [edgeId:role, ...]
    edgeList.forEach((e) => {
      const sides = sideAssignment.get(e.id);
      if (!sides) return;
      const sKey = `${e.sourceId}|${sides.sourceSide}`;
      if (!portGroups.has(sKey)) portGroups.set(sKey, []);
      portGroups.get(sKey)!.push(`${e.id}:source`);

      const tKey = `${e.targetId}|${sides.targetSide}`;
      if (!portGroups.has(tKey)) portGroups.set(tKey, []);
      portGroups.get(tKey)!.push(`${e.id}:target`);
    });

    // Pair groups (edges between same two nodes)
    const pairGroups = new Map<string, string[]>();
    edgeList.forEach((e) => {
      const pairKey = [e.sourceId, e.targetId].sort().join('|');
      if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
      pairGroups.get(pairKey)!.push(e.id);
    });

    // ── Compute all edge paths for crossing detection ──
    const edgePaths: Array<{ edgeId: string; pathD: string }> = [];
    edgeList.forEach((e) => {
      const sides = sideAssignment.get(e.id);
      if (!sides) return;
      const sRect = nodeRects.get(e.sourceId);
      const tRect = nodeRects.get(e.targetId);
      if (!sRect || !tRect) return;

      // Self-loops don't participate in crossing detection
      if (e.sourceId === e.targetId) return;

      const { sourceSide, targetSide } = sides;

      // Get port indices
      const sKey = `${e.sourceId}|${sourceSide}`;
      const sourceGroup = portGroups.get(sKey) ?? [];
      const sourceIdx = Math.max(0, sourceGroup.indexOf(`${e.id}:source`));
      const sourceGroupSize = sourceGroup.length;

      const tKey = `${e.targetId}|${targetSide}`;
      const targetGroup = portGroups.get(tKey) ?? [];
      const targetIdx = Math.max(0, targetGroup.indexOf(`${e.id}:target`));
      const targetGroupSize = targetGroup.length;

      const spreadSource = spreadHandlePosition(
        sourceSide, sourceGroupSize, sourceIdx,
        sRect.x, sRect.y, sRect.width, sRect.height,
      );
      const spreadTarget = spreadHandlePosition(
        targetSide, targetGroupSize, targetIdx,
        tRect.x, tRect.y, tRect.width, tRect.height,
      );

      // Pair channel offset
      const pairKey = [e.sourceId, e.targetId].sort().join('|');
      const pairGroup = pairGroups.get(pairKey) ?? [e.id];
      const pairIdx = Math.max(0, pairGroup.indexOf(e.id));
      const pairSize = pairGroup.length;
      let channelOffset = 0;
      if (pairSize > 1) {
        const totalSpan = PAIR_EDGE_SPACING * (pairSize - 1);
        channelOffset = -totalSpan / 2 + PAIR_EDGE_SPACING * pairIdx;
      }

      const sPos = sideToPosition(sourceSide);
      const tPos = sideToPosition(targetSide);

      const [pathD] = computeOrthogonalPath(
        spreadSource.x, spreadSource.y, sPos,
        spreadTarget.x, spreadTarget.y, tPos,
        channelOffset, pairIdx, pairSize,
        nodeRects, e.sourceId, e.targetId,
      );
      edgePaths.push({ edgeId: e.id, pathD });
    });

    // Detect crossings between all edge paths
    const crossings = detectCrossings(edgePaths);

    return { nodeRects, sideAssignment, portGroups, pairGroups, crossings };
  }, [nodes, edges]);
}

// ─────────────────────────────────────────────────────────────────
// useEdgeCoords — per-edge coordinate computation
// ─────────────────────────────────────────────────────────────────

function useEdgeCoords(
  edgeId: string,
  data: EcoreEdgeData | undefined,
) {
  const layout = useGlobalEdgeLayout();
  const { nodeRects, sideAssignment, portGroups, pairGroups, crossings } = layout;

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
    crossings,
  };
}

// ─────────────────────────────────────────────────────────────────
// Edge components
// ─────────────────────────────────────────────────────────────────

function ReferenceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY } = props;
  const coords = useEdgeCoords(id, data);

  if (!coords) {
    // Fallback: straight line
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
      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: colors.stroke, strokeWidth: 1.5, strokeLinecap: 'round',
          transition: 'opacity 0.15s', opacity: selected ? 0.85 : 1,
        }}
        markerEnd={`url(#arrow-${id})`}
      />
      <CrossingBridges edgeId={id} crossings={edgeCrossings ?? []} strokeColor={colors.stroke} />
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
      <CrossingBridges edgeId={id} crossings={edgeCrossings ?? []} strokeColor={colors.stroke} strokeWidth={2} />
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
      <CrossingBridges edgeId={id} crossings={edgeCrossings ?? []} strokeColor={color} />
    </>
  );
}

export const edgeTypes = {
  referenceEdge: ReferenceEdge,
  containmentEdge: ContainmentEdge,
  inheritanceEdge: InheritanceEdge,
};
