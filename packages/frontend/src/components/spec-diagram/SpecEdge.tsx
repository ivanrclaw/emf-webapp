/**
 * @emf-webapp/frontend — SpecEdge
 *
 * ReactFlow custom edge that renders a PREVIEW of how an EdgeMapping
 * will look in the runtime editor. Supports all line styles, decorations,
 * and label rendering.
 */
import { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeMapping, DecorationArrow, LineStyleType, RoutingStyle } from './types';
import { useEdgeRouting } from '../../hooks/useEdgeRouting';
import { CrossingBridges } from '../shared/CrossingBridges';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SpecEdgeData extends Record<string, unknown> {
  edgeMapping: EdgeMapping;
  selected: boolean;
}

/* ------------------------------------------------------------------ */
/*  Stroke Dash Arrays                                                 */
/* ------------------------------------------------------------------ */

function getStrokeDasharray(lineStyle: LineStyleType): string | undefined {
  switch (lineStyle) {
    case 'dash': return '8 4';
    case 'dot': return '2 4';
    case 'dash-dot': return '8 4 2 4';
    default: return undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  SVG Marker Definitions                                             */
/* ------------------------------------------------------------------ */

function markerId(edgeId: string, end: 'source' | 'target', type: DecorationArrow): string {
  return `spec-marker-${end}-${type}-${edgeId}`;
}

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <path d="M 1 1 L 11 6 L 1 11" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </marker>
  );
}

function OpenArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <path d="M 1 1 L 11 6 L 1 11" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </marker>
  );
}

function FilledArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <path d="M 1 1 L 11 6 L 1 11 Z" fill={color} stroke={color} strokeWidth={1} />
    </marker>
  );
}

function DiamondMarker({ id, color, filled }: { id: string; color: string; filled: boolean }) {
  return (
    <marker id={id} viewBox="0 0 14 14" refX="12" refY="7" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
      <polygon
        points="7,1 13,7 7,13 1,7"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </marker>
  );
}

function TriangleMarker({ id, color, filled }: { id: string; color: string; filled: boolean }) {
  return (
    <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <polygon
        points="1,1 11,6 1,11"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </marker>
  );
}

function renderMarker(id: string, decoration: DecorationArrow, color: string) {
  switch (decoration) {
    case 'arrow': return <FilledArrowMarker id={id} color={color} />;
    case 'open-arrow': return <OpenArrowMarker id={id} color={color} />;
    case 'diamond': return <DiamondMarker id={id} color={color} filled={false} />;
    case 'filled-diamond': return <DiamondMarker id={id} color={color} filled={true} />;
    case 'triangle': return <TriangleMarker id={id} color={color} filled={false} />;
    case 'filled-triangle': return <TriangleMarker id={id} color={color} filled={true} />;
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Path computation based on routing style                            */
/* ------------------------------------------------------------------ */

function computePath(
  routingStyle: RoutingStyle,
  params: { sourceX: number; sourceY: number; sourcePosition: any; targetX: number; targetY: number; targetPosition: any },
): [string, number, number] {
  let result: [string, number, number, number, number];
  if (routingStyle === 'manhattan' || routingStyle === 'tree') {
    result = getSmoothStepPath(params);
  } else {
    result = getBezierPath(params);
  }
  return [result[0], result[1], result[2]];
}

/* ------------------------------------------------------------------ */
/*  SpecEdge Component                                                 */
/* ------------------------------------------------------------------ */

function SpecEdge(props: EdgeProps) {
  const {
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data,
    source: srcId,
    target: tgtId,
  } = props;

  const edgeData = data as SpecEdgeData | undefined;
  const edgeMapping = edgeData?.edgeMapping;
  const selected = edgeData?.selected ?? false;

  // Edge routing info
  const { groupInfo } = useEdgeRouting(id, srcId, tgtId);

  if (!edgeMapping) {
    // Fallback: render a simple bezier edge
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
    return <BaseEdge path={path} style={{ stroke: '#6366f1', strokeWidth: 2 }} />;
  }

  const style = edgeMapping.defaultStyle;
  const color = style.color;
  const lineWidth = selected ? style.lineWidth + 1 : style.lineWidth;
  const dashArray = getStrokeDasharray(style.lineStyle);

  // Compute label text
  const label = edgeMapping.sourceReference || edgeMapping.domainClass || '';

  // Compute path
  const [edgePath, labelX, labelY] = computePath(style.routingStyle, {
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  // Marker IDs
  const sourceMarkerId = style.sourceDecoration !== 'none'
    ? markerId(id, 'source', style.sourceDecoration)
    : undefined;
  const targetMarkerId = style.targetDecoration !== 'none'
    ? markerId(id, 'target', style.targetDecoration)
    : undefined;

  return (
    <>
      {/* SVG marker definitions */}
      <defs>
        {sourceMarkerId && renderMarker(sourceMarkerId, style.sourceDecoration, color)}
        {targetMarkerId && renderMarker(targetMarkerId, style.targetDecoration, color)}
      </defs>

      <BaseEdge
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: lineWidth,
          strokeDasharray: dashArray,
          markerStart: sourceMarkerId ? `url(#${sourceMarkerId})` : undefined,
          markerEnd: targetMarkerId ? `url(#${targetMarkerId})` : undefined,
        }}
      />

      <CrossingBridges edgeId={id} crossings={[]} />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: 'var(--surface, #1e1e2e)',
              border: `1px solid ${color}`,
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: style.labelSize,
              fontWeight: 600,
              color: style.labelColor,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
              boxShadow: selected ? `0 0 0 2px ${color}40` : undefined,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(SpecEdge);
