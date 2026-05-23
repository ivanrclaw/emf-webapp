/**
 * @emf-webapp/frontend — EdgeLayoutContext
 *
 * Computes the global edge layout ONCE per render cycle and shares it
 * via React Context. This avoids the O(N²) cost of each edge component
 * independently computing crossings and side assignments.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useNodes, useEdges, type Node, type Edge } from '@xyflow/react';
import type { EcoreEdgeData } from '../types';
import {
  computeGlobalSideAssignment,
  spreadHandlePosition,
  detectCrossings,
} from '../../../lib/edge-routing';
import type { Side, NodeRect, CrossingPoint } from '../../../lib/edge-routing';

// ─── Types ───────────────────────────────────────────────────────────────

export interface EdgeLayoutData {
  nodeRects: Map<string, NodeRect>;
  sideAssignment: Map<string, { sourceSide: Side; targetSide: Side }>;
  portGroups: Map<string, string[]>;
  pairGroups: Map<string, string[]>;
  /** Per-edge crossing points (edgeId → CrossingPoint[]) */
  crossingsMap: Map<string, CrossingPoint[]>;
}

const EMPTY_LAYOUT: EdgeLayoutData = {
  nodeRects: new Map(),
  sideAssignment: new Map(),
  portGroups: new Map(),
  pairGroups: new Map(),
  crossingsMap: new Map(),
};

const EdgeLayoutCtx = createContext<EdgeLayoutData>(EMPTY_LAYOUT);

// ─── Constants (shared with CustomEdges) ─────────────────────────────────

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 140;
const PAIR_EDGE_SPACING = 30;
const RISER_SPACING = 14;
const BEND_DIST = 18;
const CORNER_RADIUS = 6;
const NODE_MARGIN = 12;

// ─── Node avoidance helpers ──────────────────────────────────────────────

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

// ─── Orthogonal path computation (for crossing detection) ────────────────

function sideToPosition(side: Side) {
  switch (side) {
    case 'left': return 0; // Position.Left
    case 'right': return 2; // Position.Right
    case 'top': return 1; // Position.Top
    case 'bottom': return 3; // Position.Bottom
  }
}

const POS_LEFT = 0;
const POS_RIGHT = 2;
const POS_TOP = 1;
const POS_BOTTOM = 3;

function computePathForCrossings(
  sx: number, sy: number, sPos: number,
  tx: number, ty: number, tPos: number,
  channelOffset: number,
  pairGroupIndex: number,
  nodeRects: Map<string, NodeRect>,
  sourceId: string,
  targetId: string,
): string {
  const R = CORNER_RADIUS;
  const isHorizSource = sPos === POS_LEFT || sPos === POS_RIGHT;
  const isHorizTarget = tPos === POS_LEFT || tPos === POS_RIGHT;

  const excludeIds = new Set([sourceId, targetId]);

  if (isHorizSource && isHorizTarget) {
    const sDir = sPos === POS_RIGHT ? 1 : -1;
    const tDir = tPos === POS_LEFT ? -1 : 1;
    const riserOffset = RISER_SPACING * pairGroupIndex;
    let b1x = sx + sDir * (BEND_DIST + riserOffset);
    const b4x = tx + tDir * (BEND_DIST + riserOffset);

    // Node avoidance on risers
    b1x = findSafeVerticalChannel(b1x, sy, (sy + ty) / 2, nodeRects, excludeIds);

    let midY = (sy + ty) / 2 + channelOffset;
    midY = findSafeHorizontalChannel(midY, Math.min(b1x, b4x), Math.max(b1x, b4x), nodeRects, excludeIds);

    if (Math.abs(midY - sy) < 3 && Math.abs(midY - ty) < 3) {
      return `M ${sx} ${sy} L ${tx} ${ty}`;
    }

    const r = Math.max(0, Math.min(R, Math.abs(midY - sy) / 2, Math.abs(midY - ty) / 2, Math.abs(b1x - sx) / 2));
    const yDir1 = midY > sy ? 1 : -1;
    const yDir2 = ty > midY ? 1 : -1;
    const xDirMid = b4x > b1x ? 1 : -1;

    return [
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
  }

  if (!isHorizSource && !isHorizTarget) {
    const sDir = sPos === POS_BOTTOM ? 1 : -1;
    const tDir = tPos === POS_TOP ? -1 : 1;
    const riserOffset = RISER_SPACING * pairGroupIndex;
    let b1y = sy + sDir * (BEND_DIST + riserOffset);
    const b4y = ty + tDir * (BEND_DIST + riserOffset);

    b1y = findSafeHorizontalChannel(b1y, sx, (sx + tx) / 2, nodeRects, excludeIds);

    let midX = (sx + tx) / 2 + channelOffset;
    midX = findSafeVerticalChannel(midX, Math.min(b1y, b4y), Math.max(b1y, b4y), nodeRects, excludeIds);

    if (Math.abs(midX - sx) < 3 && Math.abs(midX - tx) < 3) {
      return `M ${sx} ${sy} L ${tx} ${ty}`;
    }

    const r = Math.max(0, Math.min(R, Math.abs(midX - sx) / 2, Math.abs(midX - tx) / 2, Math.abs(b1y - sy) / 2));
    const xDir1 = midX > sx ? 1 : -1;
    const xDir2 = tx > midX ? 1 : -1;
    const yDirMid = b4y > b1y ? 1 : -1;

    return [
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
  }

  // Mixed L-shape
  const r = Math.max(0, Math.min(R, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2));
  if (isHorizSource && !isHorizTarget) {
    const xDir = tx > sx ? 1 : -1;
    const yDir = ty > sy ? 1 : -1;
    return [
      `M ${sx} ${sy}`,
      `L ${tx - xDir * r} ${sy}`,
      `Q ${tx} ${sy} ${tx} ${sy + yDir * r}`,
      `L ${tx} ${ty}`,
    ].join(' ');
  }

  const xDir = tx > sx ? 1 : -1;
  const yDir = ty > sy ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${ty - yDir * r}`,
    `Q ${sx} ${ty} ${sx + xDir * r} ${ty}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}

// ─── Provider ────────────────────────────────────────────────────────────

export function EdgeLayoutProvider({ children }: { children: React.ReactNode }) {
  const nodes = useNodes();
  const edges = useEdges();

  const layout = useMemo<EdgeLayoutData>(() => {
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

    // Build edge list
    const edgeList = edges.map((e) => {
      const data = e.data as EcoreEdgeData | undefined;
      return {
        id: e.id,
        sourceId: data?.sourceId ?? e.source,
        targetId: data?.targetId ?? e.target,
      };
    });

    // Global side assignment
    const sideAssignment = computeGlobalSideAssignment(edgeList, nodeRects);

    // Port groups per (nodeId, side)
    const portGroups = new Map<string, string[]>();
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

    // Pair groups
    const pairGroups = new Map<string, string[]>();
    edgeList.forEach((e) => {
      const pairKey = [e.sourceId, e.targetId].sort().join('|');
      if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
      pairGroups.get(pairKey)!.push(e.id);
    });

    // Compute all paths for crossing detection
    const edgePaths: Array<{ edgeId: string; pathD: string }> = [];
    edgeList.forEach((e) => {
      if (e.sourceId === e.targetId) return; // skip self-loops
      const sides = sideAssignment.get(e.id);
      if (!sides) return;
      const sRect = nodeRects.get(e.sourceId);
      const tRect = nodeRects.get(e.targetId);
      if (!sRect || !tRect) return;

      const { sourceSide, targetSide } = sides;

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

      const pathD = computePathForCrossings(
        spreadSource.x, spreadSource.y, sPos,
        spreadTarget.x, spreadTarget.y, tPos,
        channelOffset, pairIdx,
        nodeRects, e.sourceId, e.targetId,
      );
      edgePaths.push({ edgeId: e.id, pathD });
    });

    // Detect crossings
    const allCrossings = detectCrossings(edgePaths);

    // Build per-edge crossing map
    const crossingsMap = new Map<string, CrossingPoint[]>();
    allCrossings.forEach((c) => {
      // Both edges get the crossing point — the "over" edge renders the bridge
      if (!crossingsMap.has(c.edgeId1)) crossingsMap.set(c.edgeId1, []);
      crossingsMap.get(c.edgeId1)!.push(c);
      if (!crossingsMap.has(c.edgeId2)) crossingsMap.set(c.edgeId2, []);
      crossingsMap.get(c.edgeId2)!.push({ ...c, edgeId1: c.edgeId2, edgeId2: c.edgeId1 });
    });

    return { nodeRects, sideAssignment, portGroups, pairGroups, crossingsMap };
  }, [nodes, edges]);

  return (
    <EdgeLayoutCtx.Provider value={layout}>
      {children}
    </EdgeLayoutCtx.Provider>
  );
}

export function useEdgeLayout(): EdgeLayoutData {
  return useContext(EdgeLayoutCtx);
}
