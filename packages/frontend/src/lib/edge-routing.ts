/**
 * @emf-webapp/frontend — Edge Routing Utilities (Pure Logic)
 *
 * Edge spreading: offsets handle positions along a node side when multiple
 * edges share that side, preventing visual overlap.
 *
 * KEY INSIGHT: grouping is done per SIDE, not per edge pair (source→target).
 * All edges exiting from the same source side are spread together, regardless
 * of their target. All edges entering the same target side are spread together.
 */
import { Position, getSmoothStepPath } from '@xyflow/react';

export const EDGE_SPACING = 24;
export const SIDE_MARGIN = 12;
export const BRIDGE_RADIUS = 4;

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

// ─── Edge Grouping (by source side and target side independently) ────────────

/**
 * Groups edges into two independent dimensions:
 * 1. Source side: edges leaving from the same node+side get spread
 * 2. Target side: edges arriving at the same node+side get spread
 *
 * @param edges Array of edge objects with id, source, target, sourcePosition, targetPosition
 *              (sourcePosition/targetPosition are strings like 'left', 'right', 'top', 'bottom'
 *               or Position enum values)
 * @returns Map<edgeId, EdgeGroupInfo>
 */
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
  // Use (sourceId, effectiveSide) as key for source grouping
  const sourceGroups = new Map<string, string[]>();
  const targetGroups = new Map<string, string[]>();

  function effectiveSide(pos: string | null | undefined, handle: string | null | undefined): string {
    if (handle && ['top', 'bottom', 'left', 'right'].includes(handle)) return handle;
    if (pos && ['0', '1', '2', '3'].includes(pos)) {
      const map: Record<string, string> = { '0': 'left', '1': 'top', '2': 'right', '3': 'bottom' };
      return map[pos] ?? 'right';
    }
    // Default fallback based on handle id conventions
    if (handle === 'top' || handle === 'bottom' || handle === 'left' || handle === 'right') return handle!;
    return 'right'; // default
  }

  // Unified grouping: all edges touching (nodeId, side) regardless of direction
  // Each entry stores { edgeId, role: 'source' | 'target' }
  const unifiedGroups = new Map<string, Array<{ id: string; role: 'source' | 'target' }>>();

  edges.forEach((e) => {
    const sSide = effectiveSide(e.sourcePosition, e.sourceHandle);
    const sKey = `${e.source}|${sSide}`;
    if (!sourceGroups.has(sKey)) sourceGroups.set(sKey, []);
    sourceGroups.get(sKey)!.push(e.id);

    // Add to unified group for source node+side
    if (!unifiedGroups.has(sKey)) unifiedGroups.set(sKey, []);
    unifiedGroups.get(sKey)!.push({ id: e.id, role: 'source' });

    const tSide = effectiveSide(e.targetPosition, e.targetHandle);
    const tKey = `${e.target}|${tSide}`;
    if (!targetGroups.has(tKey)) targetGroups.set(tKey, []);
    targetGroups.get(tKey)!.push(e.id);

    // Add to unified group for target node+side
    if (!unifiedGroups.has(tKey)) unifiedGroups.set(tKey, []);
    unifiedGroups.get(tKey)!.push({ id: e.id, role: 'target' });
  });

  // Build unified index/size maps per edge per role
  // sourceUnifiedIdx: for edge X as source at node+side, what's its index in the unified group?
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

  // Legacy source/target groups kept for backward compat but no longer used for spreading
  // (unified groups above supersede them)

  // Pair grouping: edges connecting the same two nodes (bidirectional)
  // Key is sorted pair so A→B and B→A are in the same group
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
  // Collect all unique edge IDs
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

// ─── Handle Spreading ───────────────────────────────────────────────────────

export function spreadHandlePosition(
  side: 'left' | 'right' | 'top' | 'bottom',
  groupSize: number,
  groupIndex: number,
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  if (groupSize <= 1) {
    switch (side) {
      case 'left':   return { x: nodeX, y: nodeY + nodeHeight / 2 };
      case 'right':  return { x: nodeX + nodeWidth, y: nodeY + nodeHeight / 2 };
      case 'top':    return { x: nodeX + nodeWidth / 2, y: nodeY };
      case 'bottom': return { x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight };
    }
  }

  const sideLen = (side === 'left' || side === 'right') ? nodeHeight : nodeWidth;
  const usableSpan = Math.min(EDGE_SPACING * (groupSize - 1), sideLen - 2 * SIDE_MARGIN);
  const spacing = groupSize > 1 ? Math.max(usableSpan / (groupSize - 1), 4) : 0;
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

function positionToSide(pos: Position): 'left' | 'right' | 'top' | 'bottom' {
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

// ─── Crossing Detection ─────────────────────────────────────────────────────

function parseSegments(pathD: string): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const re = /([ML])\s*(-?\d+(?:\.\d+)?)\s*[ ,]\s*(-?\d+(?:\.\d+)?)/g;
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
