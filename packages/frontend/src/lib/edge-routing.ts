/**
 * @emf-webapp/frontend — Edge Routing Utilities (Pure Logic)
 *
 * Professional edge routing with:
 * - Congestion-aware side selection
 * - Adaptive port spreading along node sides
 * - Global channel assignment to prevent corridor overlaps
 * - Self-loop handling
 * - Label collision avoidance
 */
import { Position, getSmoothStepPath } from '@xyflow/react';

export const EDGE_SPACING = 20;
export const SIDE_MARGIN = 10;
export const BRIDGE_RADIUS = 4;
export const MIN_PORT_SPACING = 8;
export const CHANNEL_SPACING = 18;
export const SELF_LOOP_SIZE = 50;

export interface EdgeGroupInfo {
  /** How many edges share this source side? */
  sourceGroupSize: number;
  /** This edge's index among edges sharing its source side */
  sourceGroupIndex: number;
  /** How many edges share this target side? */
  targetGroupSize: number;
  /** This edge's index among edges sharing its target side */
  targetGroupIndex: number;
  /** How many edges connect the same node pair (bidirectional)? */
  pairGroupSize: number;
  /** This edge's index among edges connecting the same node pair */
  pairGroupIndex: number;
}

export interface CrossingPoint {
  edgeId1: string;
  edgeId2: string;
  point: { x: number; y: number };
  angle: number;
}

export type Side = 'left' | 'right' | 'top' | 'bottom';

// ─── Edge Grouping ───────────────────────────────────────────────────────

export function collectEdgeGroups(
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourcePosition?: string | null;
    targetPosition?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>,
): Map<string, EdgeGroupInfo> {
  const sourceGroups = new Map<string, string[]>();
  const targetGroups = new Map<string, string[]>();

  function effectiveSide(pos: string | null | undefined, handle: string | null | undefined): string {
    if (handle && ['top', 'bottom', 'left', 'right'].includes(handle)) return handle;
    if (pos && ['0', '1', '2', '3'].includes(pos)) {
      const map: Record<string, string> = { '0': 'left', '1': 'top', '2': 'right', '3': 'bottom' };
      return map[pos] ?? 'right';
    }
    return 'right';
  }

  const unifiedGroups = new Map<string, Array<{ id: string; role: 'source' | 'target' }>>();

  edges.forEach((e) => {
    const sSide = effectiveSide(e.sourcePosition, e.sourceHandle);
    const sKey = `${e.source}|${sSide}`;
    if (!sourceGroups.has(sKey)) sourceGroups.set(sKey, []);
    sourceGroups.get(sKey)!.push(e.id);
    if (!unifiedGroups.has(sKey)) unifiedGroups.set(sKey, []);
    unifiedGroups.get(sKey)!.push({ id: e.id, role: 'source' });

    const tSide = effectiveSide(e.targetPosition, e.targetHandle);
    const tKey = `${e.target}|${tSide}`;
    if (!targetGroups.has(tKey)) targetGroups.set(tKey, []);
    targetGroups.get(tKey)!.push(e.id);
    if (!unifiedGroups.has(tKey)) unifiedGroups.set(tKey, []);
    unifiedGroups.get(tKey)!.push({ id: e.id, role: 'target' });
  });

  const sourceUnifiedIdx = new Map<string, number>();
  const sourceUnifiedSize = new Map<string, number>();
  const targetUnifiedIdx = new Map<string, number>();
  const targetUnifiedSize = new Map<string, number>();

  unifiedGroups.forEach((entries) => {
    entries.forEach((entry, i) => {
      if (entry.role === 'source') {
        sourceUnifiedIdx.set(entry.id, i);
        sourceUnifiedSize.set(entry.id, entries.length);
      } else {
        targetUnifiedIdx.set(entry.id, i);
        targetUnifiedSize.set(entry.id, entries.length);
      }
    });
  });

  // Pair grouping: edges connecting the same two nodes (bidirectional)
  const pairGroups = new Map<string, string[]>();
  edges.forEach((e) => {
    const pairKey = [e.source, e.target].sort().join('|');
    if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
    pairGroups.get(pairKey)!.push(e.id);
  });

  const pairIdx = new Map<string, number>();
  const pairSize = new Map<string, number>();
  pairGroups.forEach((ids) => {
    ids.forEach((id, i) => {
      pairIdx.set(id, i);
      pairSize.set(id, ids.length);
    });
  });

  const result = new Map<string, EdgeGroupInfo>();
  const allIds = new Set(edges.map((e) => e.id));
  allIds.forEach((id) => {
    result.set(id, {
      sourceGroupSize: sourceUnifiedSize.get(id) ?? 1,
      sourceGroupIndex: sourceUnifiedIdx.get(id) ?? 0,
      targetGroupSize: targetUnifiedSize.get(id) ?? 1,
      targetGroupIndex: targetUnifiedIdx.get(id) ?? 0,
      pairGroupSize: pairSize.get(id) ?? 1,
      pairGroupIndex: pairIdx.get(id) ?? 0,
    });
  });

  return result;
}

// ─── Congestion-Aware Side Selection ─────────────────────────────────────

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the best sides for all edges globally, considering congestion.
 * Returns a map of edgeId → { sourceSide, targetSide }.
 *
 * Algorithm:
 * 1. Sort edges by distance (shortest first — they get priority)
 * 2. For each edge, pick the side combination that minimizes:
 *    distance * (1 + congestionPenalty)
 * 3. Track congestion per (nodeId, side) as edges are assigned
 */
export function computeGlobalSideAssignment(
  edges: Array<{ id: string; sourceId: string; targetId: string }>,
  nodeRects: Map<string, NodeRect>,
): Map<string, { sourceSide: Side; targetSide: Side }> {
  const sides: Side[] = ['left', 'right', 'top', 'bottom'];
  const congestion = new Map<string, number>(); // "nodeId|side" → count

  function getCongestion(nodeId: string, side: Side): number {
    return congestion.get(`${nodeId}|${side}`) || 0;
  }
  function addCongestion(nodeId: string, side: Side): void {
    const key = `${nodeId}|${side}`;
    congestion.set(key, (congestion.get(key) || 0) + 1);
  }

  function getPoint(rect: NodeRect, side: Side): { x: number; y: number } {
    switch (side) {
      case 'left': return { x: rect.x, y: rect.y + rect.height / 2 };
      case 'right': return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
      case 'top': return { x: rect.x + rect.width / 2, y: rect.y };
      case 'bottom': return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    }
  }

  // Sort edges by natural distance (shortest first get best sides)
  const edgesWithDist = edges.map((e) => {
    const sRect = nodeRects.get(e.sourceId);
    const tRect = nodeRects.get(e.targetId);
    if (!sRect || !tRect) return { ...e, dist: Infinity };
    const sc = { x: sRect.x + sRect.width / 2, y: sRect.y + sRect.height / 2 };
    const tc = { x: tRect.x + tRect.width / 2, y: tRect.y + tRect.height / 2 };
    const dx = sc.x - tc.x;
    const dy = sc.y - tc.y;
    return { ...e, dist: Math.sqrt(dx * dx + dy * dy) };
  });
  edgesWithDist.sort((a, b) => a.dist - b.dist);

  const result = new Map<string, { sourceSide: Side; targetSide: Side }>();

  for (const edge of edgesWithDist) {
    const sRect = nodeRects.get(edge.sourceId);
    const tRect = nodeRects.get(edge.targetId);

    if (!sRect || !tRect) {
      result.set(edge.id, { sourceSide: 'right', targetSide: 'left' });
      continue;
    }

    // Self-loop: always right→top
    if (edge.sourceId === edge.targetId) {
      result.set(edge.id, { sourceSide: 'right', targetSide: 'top' });
      addCongestion(edge.sourceId, 'right');
      addCongestion(edge.targetId, 'top');
      continue;
    }

    let bestScore = Infinity;
    let bestSS: Side = 'right';
    let bestTS: Side = 'left';

    for (const ss of sides) {
      const sp = getPoint(sRect, ss);
      for (const ts of sides) {
        const tp = getPoint(tRect, ts);
        const dx = sp.x - tp.x;
        const dy = sp.y - tp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Penalties
        const sameSidePenalty = ss === ts ? 1.2 : 1.0;
        const sourceCongestion = getCongestion(edge.sourceId, ss);
        const targetCongestion = getCongestion(edge.targetId, ts);
        const congestionPenalty = 1 + (sourceCongestion + targetCongestion) * 0.15;

        // Penalize going "against" the natural direction
        // e.g., if target is to the right, penalize using left side of source
        const dirPenalty = getDirectionPenalty(sRect, tRect, ss, ts);

        const score = dist * sameSidePenalty * congestionPenalty * dirPenalty;
        if (score < bestScore) {
          bestScore = score;
          bestSS = ss;
          bestTS = ts;
        }
      }
    }

    result.set(edge.id, { sourceSide: bestSS, targetSide: bestTS });
    addCongestion(edge.sourceId, bestSS);
    addCongestion(edge.targetId, bestTS);
  }

  return result;
}

/**
 * Penalize side choices that go against the natural direction between nodes.
 * E.g., if target is clearly to the right of source, using source's left side is bad.
 */
function getDirectionPenalty(sRect: NodeRect, tRect: NodeRect, ss: Side, ts: Side): number {
  const sc = { x: sRect.x + sRect.width / 2, y: sRect.y + sRect.height / 2 };
  const tc = { x: tRect.x + tRect.width / 2, y: tRect.y + tRect.height / 2 };
  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;

  let penalty = 1.0;

  // Source side penalty: going opposite to target direction
  if (Math.abs(dx) > Math.abs(dy)) {
    // Primarily horizontal relationship
    if (dx > 0 && ss === 'left') penalty *= 1.5;
    if (dx < 0 && ss === 'right') penalty *= 1.5;
  } else {
    // Primarily vertical relationship
    if (dy > 0 && ss === 'top') penalty *= 1.5;
    if (dy < 0 && ss === 'bottom') penalty *= 1.5;
  }

  // Target side penalty
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && ts === 'right') penalty *= 1.5;
    if (dx < 0 && ts === 'left') penalty *= 1.5;
  } else {
    if (dy > 0 && ts === 'bottom') penalty *= 1.5;
    if (dy < 0 && ts === 'top') penalty *= 1.5;
  }

  return penalty;
}

// ─── Adaptive Port Spreading ─────────────────────────────────────────────

/**
 * Spread handle positions along a node side adaptively.
 * When many edges share a side, spacing compresses but never below MIN_PORT_SPACING.
 */
export function spreadHandlePosition(
  side: Side,
  groupSize: number,
  groupIndex: number,
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  if (groupSize <= 1) {
    switch (side) {
      case 'left': return { x: nodeX, y: nodeY + nodeHeight / 2 };
      case 'right': return { x: nodeX + nodeWidth, y: nodeY + nodeHeight / 2 };
      case 'top': return { x: nodeX + nodeWidth / 2, y: nodeY };
      case 'bottom': return { x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight };
    }
  }

  const sideLen = (side === 'left' || side === 'right') ? nodeHeight : nodeWidth;
  const maxUsable = sideLen - 2 * SIDE_MARGIN;
  // Adaptive spacing: use EDGE_SPACING but compress if too many edges
  const idealSpan = EDGE_SPACING * (groupSize - 1);
  const usableSpan = Math.min(idealSpan, maxUsable);
  const spacing = groupSize > 1
    ? Math.max(usableSpan / (groupSize - 1), MIN_PORT_SPACING)
    : 0;
  const startOffset = -(spacing * (groupSize - 1)) / 2;

  switch (side) {
    case 'left':
    case 'right': {
      const yOffset = startOffset + spacing * groupIndex;
      return {
        x: side === 'left' ? nodeX : nodeX + nodeWidth,
        y: nodeY + nodeHeight / 2 + yOffset,
      };
    }
    case 'top':
    case 'bottom': {
      const xOffset = startOffset + spacing * groupIndex;
      return {
        x: nodeX + nodeWidth / 2 + xOffset,
        y: side === 'top' ? nodeY : nodeY + nodeHeight,
      };
    }
  }
}

// ─── Global Channel Assignment ───────────────────────────────────────────

export interface ChannelAssignment {
  /** The Y-coordinate for horizontal routing segments */
  channelY?: number;
  /** The X-coordinate for vertical routing segments */
  channelX?: number;
  /** Offset from the natural midpoint */
  offset: number;
}

/**
 * Assign non-overlapping routing channels to edges that share corridor space.
 * Groups edges by their approximate corridor (quantized midpoint) and spreads them.
 */
export function assignGlobalChannels(
  edgeEndpoints: Array<{
    id: string;
    sx: number; sy: number; sPos: Position;
    tx: number; ty: number; tPos: Position;
  }>,
): Map<string, number> {
  const isHorizontal = (pos: Position) => pos === Position.Left || pos === Position.Right;

  // Group edges by corridor: edges with similar midY (for horizontal routing)
  // or similar midX (for vertical routing)
  const QUANTIZE = CHANNEL_SPACING * 2; // bucket size for grouping

  interface CorridorEntry {
    id: string;
    midY: number;
    midX: number;
    isHorizRoute: boolean;
  }

  const entries: CorridorEntry[] = edgeEndpoints.map((e) => {
    const midY = (e.sy + e.ty) / 2;
    const midX = (e.sx + e.tx) / 2;
    const isHorizRoute = isHorizontal(e.sPos) && isHorizontal(e.tPos);
    return { id: e.id, midY, midX, isHorizRoute };
  });

  // Group by quantized corridor
  const corridors = new Map<string, CorridorEntry[]>();
  entries.forEach((entry) => {
    const key = entry.isHorizRoute
      ? `H:${Math.round(entry.midY / QUANTIZE)}`
      : `V:${Math.round(entry.midX / QUANTIZE)}`;
    if (!corridors.has(key)) corridors.set(key, []);
    corridors.get(key)!.push(entry);
  });

  const result = new Map<string, number>();

  corridors.forEach((group) => {
    if (group.length <= 1) {
      group.forEach((e) => result.set(e.id, 0));
      return;
    }

    // Sort by midpoint for consistent ordering
    group.sort((a, b) => {
      if (a.isHorizRoute) return a.midY - b.midY;
      return a.midX - b.midX;
    });

    // Assign offsets centered around 0
    const totalSpan = CHANNEL_SPACING * (group.length - 1);
    group.forEach((entry, i) => {
      const offset = -totalSpan / 2 + CHANNEL_SPACING * i;
      result.set(entry.id, offset);
    });
  });

  // Edges not in any corridor get 0 offset
  edgeEndpoints.forEach((e) => {
    if (!result.has(e.id)) result.set(e.id, 0);
  });

  return result;
}

// ─── Self-Loop Path ──────────────────────────────────────────────────────

/**
 * Generate a self-loop path for edges where source === target.
 * Exits from the right side, loops around above, re-enters from the top.
 */
export function computeSelfLoopPath(
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  loopIndex: number,
  loopCount: number,
): [string, number, number] {
  const loopSize = SELF_LOOP_SIZE + loopIndex * 20;
  const exitX = nodeX + nodeWidth;
  const exitY = nodeY + nodeHeight * 0.3;
  const enterX = nodeX + nodeWidth * 0.7;
  const enterY = nodeY;

  const R = 10;
  const peakX = exitX + loopSize;
  const peakY = enterY - loopSize;

  const path = [
    `M ${exitX} ${exitY}`,
    `L ${exitX + R} ${exitY}`,
    `Q ${peakX} ${exitY} ${peakX} ${exitY - R}`,
    `L ${peakX} ${peakY + R}`,
    `Q ${peakX} ${peakY} ${peakX - R} ${peakY}`,
    `L ${enterX + R} ${peakY}`,
    `Q ${enterX} ${peakY} ${enterX} ${peakY + R}`,
    `L ${enterX} ${enterY}`,
  ].join(' ');

  const labelX = peakX - loopSize / 3;
  const labelY = peakY + (exitY - peakY) / 2;

  return [path, labelX, labelY];
}

// ─── Label Collision Avoidance ───────────────────────────────────────────

export interface LabelInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Nudge overlapping labels apart. Simple greedy approach:
 * sort by Y, then push overlapping labels down.
 */
export function resolveLabelsOverlap(labels: LabelInfo[]): Map<string, { dx: number; dy: number }> {
  const offsets = new Map<string, { dx: number; dy: number }>();
  labels.forEach((l) => offsets.set(l.id, { dx: 0, dy: 0 }));

  if (labels.length <= 1) return offsets;

  // Sort by Y position
  const sorted = [...labels].sort((a, b) => a.y - b.y);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevOffset = offsets.get(prev.id)!;
    const currOffset = offsets.get(curr.id)!;

    const prevBottom = prev.y + prevOffset.dy + prev.height / 2;
    const currTop = curr.y + currOffset.dy - curr.height / 2;

    // Check horizontal overlap too
    const hOverlap = Math.abs((prev.x + prevOffset.dx) - (curr.x + currOffset.dx)) < (prev.width + curr.width) / 2;

    if (hOverlap && prevBottom > currTop - 4) {
      const nudge = prevBottom - currTop + 6;
      currOffset.dy += nudge;
    }
  }

  return offsets;
}

// ─── Legacy exports for backward compat ──────────────────────────────────

function positionToSide(pos: Position): Side {
  switch (pos) {
    case Position.Left: return 'left';
    case Position.Right: return 'right';
    case Position.Top: return 'top';
    case Position.Bottom: return 'bottom';
  }
}

export function getSpreadSmoothStepPath(
  params: {
    sourceX: number;
    sourceY: number;
    sourcePosition: Position;
    targetX: number;
    targetY: number;
    targetPosition: Position;
    sourceGroupSize: number;
    sourceGroupIndex: number;
    targetGroupSize: number;
    targetGroupIndex: number;
    sourceNode: { x: number; y: number; width: number; height: number };
    targetNode: { x: number; y: number; width: number; height: number };
  },
): [string, number, number] {
  const sourceSide = positionToSide(params.sourcePosition);
  const targetSide = positionToSide(params.targetPosition);

  const sp = spreadHandlePosition(
    sourceSide, params.sourceGroupSize, params.sourceGroupIndex,
    params.sourceNode.x, params.sourceNode.y, params.sourceNode.width, params.sourceNode.height,
  );
  const tp = spreadHandlePosition(
    targetSide, params.targetGroupSize, params.targetGroupIndex,
    params.targetNode.x, params.targetNode.y, params.targetNode.width, params.targetNode.height,
  );

  const result = getSmoothStepPath({
    sourceX: sp.x, sourceY: sp.y, sourcePosition: params.sourcePosition,
    targetX: tp.x, targetY: tp.y, targetPosition: params.targetPosition,
  });
  return [result[0], result[1], result[2]];
}

// ─── Crossing Detection ─────────────────────────────────────────────────

function parseSegments(pathD: string): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const re = /([MLQ])[\s,]*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pathD)) !== null) {
    pts.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) });
  }
  return pts;
}

function segIntersect(
  a1: { x: number; y: number }, a2: { x: number; y: number },
  b1: { x: number; y: number }, b2: { x: number; y: number },
): { x: number; y: number } | null {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: a1.x + t * dx1, y: a1.y + t * dy1 };
  }
  return null;
}

function segAngle(
  a1: { x: number; y: number }, a2: { x: number; y: number },
  b1: { x: number; y: number }, b2: { x: number; y: number },
): number {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const dot = dx1 * dx2 + dy1 * dy2;
  const m1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const m2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  if (m1 < 1e-10 || m2 < 1e-10) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2))));
}

export function detectCrossings(
  edgePaths: Array<{ edgeId: string; pathD: string }>,
): CrossingPoint[] {
  const crossings: CrossingPoint[] = [];
  for (let i = 0; i < edgePaths.length; i++) {
    const segs1 = parseSegments(edgePaths[i].pathD);
    if (segs1.length < 2) continue;
    for (let j = i + 1; j < edgePaths.length; j++) {
      const segs2 = parseSegments(edgePaths[j].pathD);
      if (segs2.length < 2) continue;
      for (let si = 0; si < segs1.length - 1; si++) {
        for (let sj = 0; sj < segs2.length - 1; sj++) {
          const pt = segIntersect(segs1[si], segs1[si + 1], segs2[sj], segs2[sj + 1]);
          if (pt) {
            crossings.push({
              edgeId1: edgePaths[i].edgeId,
              edgeId2: edgePaths[j].edgeId,
              point: pt,
              angle: segAngle(segs1[si], segs1[si + 1], segs2[sj], segs2[sj + 1]),
            });
          }
        }
      }
    }
  }
  return crossings;
}
