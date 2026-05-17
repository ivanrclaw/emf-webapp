/**
 * @emf-webapp/frontend — Edge Routing Utilities (Pure Logic)
 *
 * Edge spreading: when multiple edges connect the same pair of sides,
 * offsets handle positions along the side to prevent overlap.
 *
 * Crossing detection: detects edge path intersections and returns
 * coordinates for visual bridge rendering.
 */
import { Position, getSmoothStepPath } from '@xyflow/react';

export const EDGE_SPACING = 16;
export const SIDE_MARGIN = 12;
export const BRIDGE_RADIUS = 4;

export interface EdgeGroupInfo {
  groupSize: number;
  groupIndex: number;
}

export interface CrossingPoint {
  edgeId1: string;
  edgeId2: string;
  point: { x: number; y: number };
  angle: number;
}

// ─── Edge Grouping ──────────────────────────────────────────────────────────

export function collectEdgeGroups(
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>,
): Map<string, EdgeGroupInfo> {
  const groups = new Map<string, string[]>();
  const keyFor = (e: typeof edges[0]) =>
    `${e.source}|${e.target}|${e.sourceHandle ?? 'default'}|${e.targetHandle ?? 'default'}`;

  edges.forEach((e) => {
    const k = keyFor(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e.id);
  });

  const result = new Map<string, EdgeGroupInfo>();
  groups.forEach((ids) => {
    ids.forEach((id, idx) => result.set(id, { groupSize: ids.length, groupIndex: idx }));
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

  const usableSpan = Math.min(EDGE_SPACING * (groupSize - 1), Math.min(nodeHeight, nodeWidth) - 2 * SIDE_MARGIN);
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
    groupSize: number;
    groupIndex: number;
    sourceNode: { x: number; y: number; width: number; height: number };
    targetNode: { x: number; y: number; width: number; height: number };
  },
): [string, number, number] {
  const sourceSide = positionToSide(params.sourcePosition);
  const targetSide = positionToSide(params.targetPosition);

  const sp = spreadHandlePosition(
    sourceSide, params.groupSize, params.groupIndex,
    params.sourceNode.x, params.sourceNode.y, params.sourceNode.width, params.sourceNode.height,
  );
  const tp = spreadHandlePosition(
    targetSide, params.groupSize, params.groupIndex,
    params.targetNode.x, params.targetNode.y, params.targetNode.width, params.targetNode.height,
  );

  const result = getSmoothStepPath({
    sourceX: sp.x,
    sourceY: sp.y,
    sourcePosition: params.sourcePosition,
    targetX: tp.x,
    targetY: tp.y,
    targetPosition: params.targetPosition,
  });
  // getSmoothStepPath returns [path, labelX, labelY, offsetX, offsetY]
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
