/**
 * @emf-webapp/frontend — Custom Edge Components for Ecore Diagram Editor
 *
 * Sigue las convenciones visuales del editor de diagramas .ecore de Eclipse.
 *
 * AHORA CON: Edge spreading (evita overlap de flechas paralelas) y
 * crossing bridges (indicador visual de cruce).
 *
 * referenceEdge   → línea sólida, punta de flecha (▶) en el TARGET
 * containmentEdge → línea sólida, diamante relleno (◆) en SOURCE + flecha TARGET
 * inheritanceEdge → línea discontinua, triángulo hueco (△) en TARGET
 */
import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useNodes,
  useEdges,
  type EdgeProps,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { EcoreEdgeData, AppNode } from '../types';
import { useEdgeRouting } from '../../../hooks/useEdgeRouting';
import { spreadHandlePosition } from '../../../lib/edge-routing';
import { CrossingBridges } from '../../shared/CrossingBridges';
import type { EdgeGroupInfo } from '../../../lib/edge-routing';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 140;

function calcHandlePos(
  node: Node,
  side: 'left' | 'right' | 'top' | 'bottom',
): { x: number; y: number; position: Position } {
  const measured = (node as any)?.measured;
  const w = measured?.width ?? DEFAULT_NODE_WIDTH;
  const h = measured?.height ?? DEFAULT_NODE_HEIGHT;
  switch (side) {
    case 'left':   return { x: node.position.x, y: node.position.y + h / 2, position: Position.Left };
    case 'right':  return { x: node.position.x + w, y: node.position.y + h / 2, position: Position.Right };
    case 'top':    return { x: node.position.x + w / 2, y: node.position.y, position: Position.Top };
    case 'bottom': return { x: node.position.x + w / 2, y: node.position.y + h, position: Position.Bottom };
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
// Common edge logic with spreading
// ─────────────────────────────────────────────────────────────────

/** Spacing between parallel edges connecting the same node pair */
const PAIR_EDGE_SPACING = 40;

/** Spacing between adjacent risers in pixels */
const RISER_SPACING = 16;

/**
 * Build a custom orthogonal path with rounded corners at bends.
 * Each edge in a pair group routes through a distinct intermediate channel
 * (different Y for horizontal routing, different X for vertical routing).
 *
 * Uses quadratic bezier curves (Q) at 90° bends for a smooth look.
 */
function computeSpreadEdgePath(
  sx: number, sy: number, sPos: Position,
  tx: number, ty: number, tPos: Position,
  channelOffset: number,
  nodeMidY: number,
  nodeMidX: number,
  pairGroupIndex: number,
  pairGroupSize: number,
): [string, number, number] {
  const BEND_DIST = 20;
  const R = 5; // corner radius

  const isHorizontalSource = sPos === Position.Left || sPos === Position.Right;
  const isHorizontalTarget = tPos === Position.Left || tPos === Position.Right;

  // Both sides horizontal (most common: left↔right connections)
  if (isHorizontalSource && isHorizontalTarget) {
    const sDir = sPos === Position.Right ? 1 : -1;
    const tDir = tPos === Position.Left ? -1 : 1;

    // Spread vertical risers: each edge gets a distinct X, always moving AWAY from node
    const riserOffset = RISER_SPACING * pairGroupIndex;
    const b1x = sx + sDir * (BEND_DIST + riserOffset);
    const b4x = tx + tDir * (BEND_DIST + riserOffset);
    const midY = nodeMidY + channelOffset;

    // If midY is essentially at source/target Y, use straight path
    if (Math.abs(midY - sy) < 2 && Math.abs(midY - ty) < 2) {
      const [path, lx, ly] = getSmoothStepPath({
        sourceX: sx, sourceY: sy, sourcePosition: sPos,
        targetX: tx, targetY: ty, targetPosition: tPos,
      });
      return [path, lx, ly];
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

    const labelX = (b1x + b4x) / 2;
    const labelY = midY;
    return [path, labelX, labelY];
  }

  // Both sides vertical (top↔bottom connections)
  if (!isHorizontalSource && !isHorizontalTarget) {
    const sDir = sPos === Position.Bottom ? 1 : -1;
    const tDir = tPos === Position.Top ? -1 : 1;

    // Spread horizontal risers: each edge gets a distinct Y, always moving AWAY from node
    const riserOffset = RISER_SPACING * pairGroupIndex;
    const b1y = sy + sDir * (BEND_DIST + riserOffset);
    const b4y = ty + tDir * (BEND_DIST + riserOffset);
    const midX = nodeMidX + channelOffset;

    if (Math.abs(midX - sx) < 2 && Math.abs(midX - tx) < 2) {
      const [path, lx, ly] = getSmoothStepPath({
        sourceX: sx, sourceY: sy, sourcePosition: sPos,
        targetX: tx, targetY: ty, targetPosition: tPos,
      });
      return [path, lx, ly];
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

    const labelX = midX;
    const labelY = (b1y + b4y) / 2;
    return [path, labelX, labelY];
  }

  // Mixed case: fall back to getSmoothStepPath with unique offset
  const baseOffset = Math.max(12, 25 + channelOffset);
  const [path, lx, ly] = getSmoothStepPath({
    sourceX: sx, sourceY: sy, sourcePosition: sPos,
    targetX: tx, targetY: ty, targetPosition: tPos,
    offset: baseOffset,
  });
  return [path, lx, ly];
}

// ─────────────────────────────────────────────────────────────────
// useEdgeCoords — computes spread positions and channel offsets
// ─────────────────────────────────────────────────────────────────

function useEdgeCoords(
  data: EcoreEdgeData | undefined,
  groupInfo: EdgeGroupInfo,
) {
  const nodes = useNodes();
  const edges = useEdges();
  const sourceNode = nodes.find((n) => n.id === data?.sourceId);
  const targetNode = nodes.find((n) => n.id === data?.targetId);

  if (!sourceNode || !targetNode) return null;

  const sMeasured = (sourceNode as any)?.measured;
  const tMeasured = (targetNode as any)?.measured;
  const sW = sMeasured?.width ?? DEFAULT_NODE_WIDTH;
  const sH = sMeasured?.height ?? DEFAULT_NODE_HEIGHT;
  const tW = tMeasured?.width ?? DEFAULT_NODE_WIDTH;
  const tH = tMeasured?.height ?? DEFAULT_NODE_HEIGHT;

  type Side = 'left' | 'right' | 'top' | 'bottom';
  const sides: Side[] = ['left', 'right', 'top', 'bottom'];

  function getPoint(pos: { x: number; y: number }, side: Side, w: number, h: number) {
    switch (side) {
      case 'left': return { x: pos.x, y: pos.y + h / 2 };
      case 'right': return { x: pos.x + w, y: pos.y + h / 2 };
      case 'top': return { x: pos.x + w / 2, y: pos.y };
      case 'bottom': return { x: pos.x + w / 2, y: pos.y + h };
    }
  }

  function computeBestSides(sNode: Node, tNode: Node): { sourceSide: Side; targetSide: Side } {
    const sm = (sNode as any)?.measured;
    const tm = (tNode as any)?.measured;
    const sw = sm?.width ?? DEFAULT_NODE_WIDTH;
    const sh = sm?.height ?? DEFAULT_NODE_HEIGHT;
    const tw = tm?.width ?? DEFAULT_NODE_WIDTH;
    const th = tm?.height ?? DEFAULT_NODE_HEIGHT;

    let best = Infinity;
    let bSS: Side = 'right';
    let bTS: Side = 'left';
    for (const ss of sides) {
      const sp = getPoint(sNode.position, ss, sw, sh);
      for (const ts of sides) {
        const tp = getPoint(tNode.position, ts, tw, th);
        const dx = sp.x - tp.x;
        const dy = sp.y - tp.y;
        const dist = dx * dx + dy * dy;
        const penalty = ss === ts ? 1.3 : 1.0;
        if (dist * penalty < best) {
          best = dist * penalty;
          bSS = ss;
          bTS = ts;
        }
      }
    }
    return { sourceSide: bSS, targetSide: bTS };
  }

  const { sourceSide: bestSourceSide, targetSide: bestTargetSide } = computeBestSides(sourceNode, targetNode);

  // Compute unified spreading: find all edges touching the same (node, side)
  // and determine this edge's position among them
  let sourceGroupIndex = 0;
  let sourceGroupSize = 1;
  let targetGroupIndex = 0;
  let targetGroupSize = 1;

  // Collect all edges and compute their actual sides
  const edgeEntries: Array<{ id: string; sourceId: string; targetId: string; sourceSide: Side; targetSide: Side }> = [];
  edges.forEach((e) => {
    const eData = e.data as EcoreEdgeData | undefined;
    const sId = eData?.sourceId ?? e.source;
    const tId = eData?.targetId ?? e.target;
    const sN = nodes.find((n) => n.id === sId);
    const tN = nodes.find((n) => n.id === tId);
    if (sN && tN) {
      const { sourceSide: ss, targetSide: ts } = computeBestSides(sN, tN);
      edgeEntries.push({ id: e.id, sourceId: sId, targetId: tId, sourceSide: ss, targetSide: ts });
    }
  });

  // Group by (nodeId, side) — unified: both source and target edges on same node+side
  const nodeSideGroups = new Map<string, string[]>();
  edgeEntries.forEach((entry) => {
    const sKey = `${entry.sourceId}|${entry.sourceSide}`;
    if (!nodeSideGroups.has(sKey)) nodeSideGroups.set(sKey, []);
    nodeSideGroups.get(sKey)!.push(`${entry.id}:source`);

    const tKey = `${entry.targetId}|${entry.targetSide}`;
    if (!nodeSideGroups.has(tKey)) nodeSideGroups.set(tKey, []);
    nodeSideGroups.get(tKey)!.push(`${entry.id}:target`);
  });

  // Find this edge's index in source node+side group
  const sourceKey = `${data?.sourceId}|${bestSourceSide}`;
  const sourceGroup = nodeSideGroups.get(sourceKey) ?? [];
  const mySourceEntry = `${data?.sourceId ? edges.find(e => (e.data as any)?.sourceId === data?.sourceId && (e.data as any)?.targetId === data?.targetId && (e.data as any)?.label === data?.label)?.id : ''}:source`;
  // Find by matching current edge in the group
  const currentEdge = edges.find(e => {
    const ed = e.data as EcoreEdgeData | undefined;
    return ed?.sourceId === data?.sourceId && ed?.targetId === data?.targetId && ed?.label === data?.label;
  });
  if (currentEdge) {
    const idx = sourceGroup.indexOf(`${currentEdge.id}:source`);
    if (idx >= 0) {
      sourceGroupIndex = idx;
      sourceGroupSize = sourceGroup.length;
    }
  }

  // Find this edge's index in target node+side group
  const targetKey = `${data?.targetId}|${bestTargetSide}`;
  const targetGroup = nodeSideGroups.get(targetKey) ?? [];
  if (currentEdge) {
    const idx = targetGroup.indexOf(`${currentEdge.id}:target`);
    if (idx >= 0) {
      targetGroupIndex = idx;
      targetGroupSize = targetGroup.length;
    }
  }

  // Apply spreading with unified groups
  const spreadSource = spreadHandlePosition(
    bestSourceSide, sourceGroupSize, sourceGroupIndex,
    sourceNode.position.x, sourceNode.position.y, sW, sH,
  );
  const spreadTarget = spreadHandlePosition(
    bestTargetSide, targetGroupSize, targetGroupIndex,
    targetNode.position.x, targetNode.position.y, tW, tH,
  );

  // Compute channel offset for parallel edges between the same two nodes.
  let channelOffset = 0;
  if (groupInfo.pairGroupSize > 1) {
    const totalSpan = PAIR_EDGE_SPACING * (groupInfo.pairGroupSize - 1);
    channelOffset = -totalSpan / 2 + PAIR_EDGE_SPACING * groupInfo.pairGroupIndex;
  }

  // Stable mid-points from node centers for consistent channel base
  const sourceCenterY = sourceNode.position.y + sH / 2;
  const targetCenterY = targetNode.position.y + tH / 2;
  const sourceCenterX = sourceNode.position.x + sW / 2;
  const targetCenterX = targetNode.position.x + tW / 2;
  const nodeMidY = (sourceCenterY + targetCenterY) / 2;
  const nodeMidX = (sourceCenterX + targetCenterX) / 2;

  return {
    sourceX: spreadSource.x,
    sourceY: spreadSource.y,
    sourcePosition: calcHandlePos(sourceNode, bestSourceSide).position,
    targetX: spreadTarget.x,
    targetY: spreadTarget.y,
    targetPosition: calcHandlePos(targetNode, bestTargetSide).position,
    bestSourceSide,
    bestTargetSide,
    channelOffset,
    nodeMidY,
    nodeMidX,
    pairGroupIndex: groupInfo.pairGroupIndex,
    pairGroupSize: groupInfo.pairGroupSize,
  };
}

// ─────────────────────────────────────────────────────────────────
// Edge components
// ─────────────────────────────────────────────────────────────────

function ReferenceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, source: src, target: tgt } = props;
  const { groupInfo } = useEdgeRouting(id, src, tgt);
  const coords = useEdgeCoords(data, groupInfo);

  const effSourceX = coords?.sourceX ?? sourceX;
  const effSourceY = coords?.sourceY ?? sourceY;
  const effTargetX = coords?.targetX ?? targetX;
  const effTargetY = coords?.targetY ?? targetY;
  const sourcePosition = coords?.sourcePosition ?? Position.Right;
  const targetPosition = coords?.targetPosition ?? Position.Left;

  const [edgePath, labelX, labelY] = computeSpreadEdgePath(
    effSourceX, effSourceY, sourcePosition,
    effTargetX, effTargetY, targetPosition,
    coords?.channelOffset ?? 0,
    coords?.nodeMidY ?? (effSourceY + effTargetY) / 2,
    coords?.nodeMidX ?? (effSourceX + effTargetX) / 2,
    coords?.pairGroupIndex ?? 0,
    coords?.pairGroupSize ?? 1,
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
      <CrossingBridges edgeId={id} crossings={[]} />
      {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
    </>
  );
}

function ContainmentEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, source: src, target: tgt } = props;
  const { groupInfo } = useEdgeRouting(id, src, tgt);
  const coords = useEdgeCoords(data, groupInfo);

  const effSourceX = coords?.sourceX ?? sourceX;
  const effSourceY = coords?.sourceY ?? sourceY;
  const effTargetX = coords?.targetX ?? targetX;
  const effTargetY = coords?.targetY ?? targetY;
  const sourcePosition = coords?.sourcePosition ?? Position.Right;
  const targetPosition = coords?.targetPosition ?? Position.Left;

  const [edgePath, labelX, labelY] = computeSpreadEdgePath(
    effSourceX, effSourceY, sourcePosition,
    effTargetX, effTargetY, targetPosition,
    coords?.channelOffset ?? 0,
    coords?.nodeMidY ?? (effSourceY + effTargetY) / 2,
    coords?.nodeMidX ?? (effSourceX + effTargetX) / 2,
    coords?.pairGroupIndex ?? 0,
    coords?.pairGroupSize ?? 1,
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
      <CrossingBridges edgeId={id} crossings={[]} />
      {renderCombinedLabel(label, cardinality, labelX, labelY, colors)}
    </>
  );
}

function InheritanceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, source: src, target: tgt } = props;
  const { groupInfo } = useEdgeRouting(id, src, tgt);
  const coords = useEdgeCoords(data, groupInfo);

  const effSourceX = coords?.sourceX ?? sourceX;
  const effSourceY = coords?.sourceY ?? sourceY;
  const effTargetX = coords?.targetX ?? targetX;
  const effTargetY = coords?.targetY ?? targetY;
  const sourcePosition = coords?.sourcePosition ?? Position.Right;
  const targetPosition = coords?.targetPosition ?? Position.Left;

  const [edgePath] = computeSpreadEdgePath(
    effSourceX, effSourceY, sourcePosition,
    effTargetX, effTargetY, targetPosition,
    coords?.channelOffset ?? 0,
    coords?.nodeMidY ?? (effSourceY + effTargetY) / 2,
    coords?.nodeMidX ?? (effSourceX + effTargetX) / 2,
    coords?.pairGroupIndex ?? 0,
    coords?.pairGroupSize ?? 1,
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
      <CrossingBridges edgeId={id} crossings={[]} />
    </>
  );
}

export const edgeTypes = {
  referenceEdge: ReferenceEdge,
  containmentEdge: ContainmentEdge,
  inheritanceEdge: InheritanceEdge,
};
