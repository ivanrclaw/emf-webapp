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

/** Spacing between parallel edges connecting the same node pair (vertical/horizontal offset) */
const PAIR_EDGE_SPACING = 20;

function useEdgeCoords(
  data: EcoreEdgeData | undefined,
  groupInfo: EdgeGroupInfo,
) {
  const nodes = useNodes();
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

  let bestDist = Infinity;
  let bestSourceSide: Side = 'right';
  let bestTargetSide: Side = 'left';

  for (const sSide of sides) {
    const sp = getPoint(sourceNode.position, sSide, sW, sH);
    for (const tSide of sides) {
      const tp = getPoint(targetNode.position, tSide, tW, tH);
      const dx = sp.x - tp.x;
      const dy = sp.y - tp.y;
      const dist = dx * dx + dy * dy;
      const sameSidePenalty = sSide === tSide ? 1.3 : 1.0;
      if (dist * sameSidePenalty < bestDist) {
        bestDist = dist * sameSidePenalty;
        bestSourceSide = sSide;
        bestTargetSide = tSide;
      }
    }
  }

  // Apply spreading: source side and target side independently
  const spreadSource = spreadHandlePosition(
    bestSourceSide, groupInfo.sourceGroupSize, groupInfo.sourceGroupIndex,
    sourceNode.position.x, sourceNode.position.y, sW, sH,
  );
  const spreadTarget = spreadHandlePosition(
    bestTargetSide, groupInfo.targetGroupSize, groupInfo.targetGroupIndex,
    targetNode.position.x, targetNode.position.y, tW, tH,
  );

  // Compute pair offset for parallel edges between the same two nodes.
  // This offsets the intermediate routing channel so edges don't overlap vertically.
  // Base offset is 20 (getSmoothStepPath default). We spread around it.
  let pairOffset = 20; // default
  if (groupInfo.pairGroupSize > 1) {
    const totalSpan = PAIR_EDGE_SPACING * (groupInfo.pairGroupSize - 1);
    const centered = -totalSpan / 2 + PAIR_EDGE_SPACING * groupInfo.pairGroupIndex;
    pairOffset = Math.max(8, 20 + centered); // ensure minimum 8px from handle
  }

  return {
    sourceX: spreadSource.x,
    sourceY: spreadSource.y,
    sourcePosition: calcHandlePos(sourceNode, bestSourceSide).position,
    targetX: spreadTarget.x,
    targetY: spreadTarget.y,
    targetPosition: calcHandlePos(targetNode, bestTargetSide).position,
    bestSourceSide,
    bestTargetSide,
    pairOffset,
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

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: effSourceX, sourceY: effSourceY, sourcePosition,
    targetX: effTargetX, targetY: effTargetY, targetPosition,
    offset: coords?.pairOffset ?? 0,
  });

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

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: effSourceX, sourceY: effSourceY, sourcePosition,
    targetX: effTargetX, targetY: effTargetY, targetPosition,
    offset: coords?.pairOffset ?? 0,
  });

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

  const [edgePath] = getSmoothStepPath({
    sourceX: effSourceX, sourceY: effSourceY, sourcePosition,
    targetX: effTargetX, targetY: effTargetY, targetPosition,
    offset: coords?.pairOffset ?? 0,
  });

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
