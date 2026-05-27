/**
 * @emf-webapp/frontend — Custom Edge Components for Ecore Diagram Editor
 *
 * Edge rendering using avoid-nodes-edge for orthogonal routing that avoids nodes.
 * Falls back to React Flow's getSmoothStepPath when the router hasn't loaded yet.
 *
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
  Position,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { useAvoidNodesPath } from 'avoid-nodes-edge';
import type { EcoreEdgeData } from '../types';
import { computeSelfLoopPath } from '../../../lib/edge-routing';

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
// Compute edge path — uses avoid-nodes-edge store (libavoid WASM)
// Falls back to smooth-step when router hasn't loaded yet
// ─────────────────────────────────────────────────────────────────

function useRoutedEdgePath(
  id: string,
  sourceX: number, sourceY: number, sourcePosition: Position,
  targetX: number, targetY: number, targetPosition: Position,
) {
  const [path, labelX, labelY] = useAvoidNodesPath({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition as any,
    targetPosition: targetPosition as any,
    borderRadius: 8,
  });

  return [path, labelX, labelY] as [string, number, number];
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

  const [path, labelX, labelY] = useRoutedEdgePath(
    id, sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
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

  const [path, labelX, labelY] = useRoutedEdgePath(
    id, sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
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

  const [path] = useRoutedEdgePath(
    id, sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
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
