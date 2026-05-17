/**
 * @emf-webapp/frontend — VsmEdge: Custom ReactFlow Edge for VSM Runtime
 *
 * Renders edges according to the resolved EdgeStyleSpec from the viewpoint specification.
 * Supports:
 * - Line styles: solid, dash, dot, dash-dot
 * - Source/target decorations: arrow, open-arrow, diamond, filled-diamond, triangle, filled-triangle
 * - Routing: bezier (straight), smooth-step (manhattan/tree)
 * - Center label from expression evaluation
 * - Conditional style resolution
 */
import React, { memo, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { EdgeMapping, EdgeStyleSpec, DecorationArrow } from '../spec-diagram/types';
import { resolveEdgeStyle } from '../../lib/vsm-runtime';
import { evaluateLabel } from '../../lib/expression-engine';

// ─── Data Type ────────────────────────────────────────────────────────────────

export interface VsmEdgeData extends Record<string, unknown> {
  edgeMapping: EdgeMapping;
  sourceData?: Record<string, unknown>;
  targetData?: Record<string, unknown>;
  selected: boolean;
}

// ─── Line Style Helpers ───────────────────────────────────────────────────────

const LINE_STYLE_MAP: Record<string, string> = {
  solid: '',
  dash: '8 4',
  dot: '2 4',
  'dash-dot': '8 4 2 4',
};

function getStrokeDasharray(lineStyle: string): string {
  return LINE_STYLE_MAP[lineStyle] ?? '';
}

// ─── SVG Marker Definitions ──────────────────────────────────────────────────

function getMarkerId(edgeId: string, position: 'source' | 'target', decoration: DecorationArrow): string {
  return `vsm-marker-${edgeId}-${position}-${decoration}`;
}

function renderMarkerDef(
  edgeId: string,
  position: 'source' | 'target',
  decoration: DecorationArrow,
  color: string,
): React.ReactNode {
  if (decoration === 'none') return null;

  const id = getMarkerId(edgeId, position, decoration);
  const isSource = position === 'source';

  switch (decoration) {
    case 'arrow':
      return (
        <marker
          key={id}
          id={id}
          viewBox="0 0 12 12"
          refX={isSource ? 2 : 10}
          refY={6}
          markerWidth={10}
          markerHeight={10}
          orient="auto"
        >
          <path d="M 1 1 L 11 6 L 1 11 Z" fill={color} />
        </marker>
      );

    case 'open-arrow':
      return (
        <marker
          key={id}
          id={id}
          viewBox="0 0 12 12"
          refX={isSource ? 2 : 10}
          refY={6}
          markerWidth={10}
          markerHeight={10}
          orient="auto"
        >
          <path d="M 1 1 L 11 6 L 1 11" fill="none" stroke={color} strokeWidth={1.5} />
        </marker>
      );

    case 'diamond':
      return (
        <marker
          key={id}
          id={id}
          viewBox="0 0 14 14"
          refX={isSource ? 0 : 14}
          refY={7}
          markerWidth={12}
          markerHeight={12}
          orient="auto"
        >
          <polygon points="7,0 14,7 7,14 0,7" fill="none" stroke={color} strokeWidth={1.5} />
        </marker>
      );

    case 'filled-diamond':
      return (
        <marker
          key={id}
          id={id}
          viewBox="0 0 14 14"
          refX={isSource ? 0 : 14}
          refY={7}
          markerWidth={12}
          markerHeight={12}
          orient="auto"
        >
          <polygon points="7,0 14,7 7,14 0,7" fill={color} stroke={color} strokeWidth={1} />
        </marker>
      );

    case 'triangle':
      return (
        <marker
          key={id}
          id={id}
          viewBox="0 0 14 14"
          refX={isSource ? 2 : 12}
          refY={7}
          markerWidth={12}
          markerHeight={12}
          orient="auto"
        >
          <polygon
            points="2,1 12,7 2,13"
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </marker>
      );

    case 'filled-triangle':
      return (
        <marker
          key={id}
          id={id}
          viewBox="0 0 14 14"
          refX={isSource ? 2 : 12}
          refY={7}
          markerWidth={12}
          markerHeight={12}
          orient="auto"
        >
          <polygon points="2,1 12,7 2,13" fill={color} strokeLinejoin="round" />
        </marker>
      );

    default:
      return null;
  }
}

// ─── Path Computation ─────────────────────────────────────────────────────────

function computePath(
  routingStyle: string,
  sourceX: number,
  sourceY: number,
  sourcePosition: any,
  targetX: number,
  targetY: number,
  targetPosition: any,
): [string, number, number] {
  if (routingStyle === 'straight') {
    const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    return [path, labelX, labelY];
  }

  // manhattan and tree both use smooth step
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return [path, labelX, labelY];
}

// ─── VsmEdge Component ────────────────────────────────────────────────────────

function VsmEdgeComponent(props: EdgeProps<Edge<VsmEdgeData>>) {
  const {
    id,
    data,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    selected,
  } = props;

  const edgeMapping = data?.edgeMapping;
  const sourceData = data?.sourceData;
  const targetData = data?.targetData;

  // Resolve effective style (default + conditional overrides)
  const resolvedStyle: EdgeStyleSpec = useMemo(() => {
    if (!edgeMapping) {
      return {
        lineStyle: 'solid',
        lineWidth: 2,
        color: '#6366f1',
        sourceDecoration: 'none',
        targetDecoration: 'arrow',
        routingStyle: 'manhattan',
        labelColor: '#a1a1aa',
        labelSize: 11,
      } as EdgeStyleSpec;
    }
    return resolveEdgeStyle(edgeMapping, {
      source: sourceData,
      target: targetData,
    });
  }, [edgeMapping, sourceData, targetData]);

  // Compute path based on routing style
  const [edgePath, labelX, labelY] = useMemo(
    () =>
      computePath(
        resolvedStyle.routingStyle,
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      ),
    [resolvedStyle.routingStyle, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition],
  );

  // Evaluate center label expression
  const centerLabel = useMemo(() => {
    if (!resolvedStyle.centerLabelExpression) return '';
    // Evaluate with source data as context (common convention)
    const ctx = sourceData ?? {};
    return evaluateLabel(resolvedStyle.centerLabelExpression, { self: ctx });
  }, [resolvedStyle.centerLabelExpression, sourceData]);

  // Marker URLs
  const markerStart =
    resolvedStyle.sourceDecoration !== 'none'
      ? `url(#${getMarkerId(id, 'source', resolvedStyle.sourceDecoration)})`
      : undefined;

  const markerEnd =
    resolvedStyle.targetDecoration !== 'none'
      ? `url(#${getMarkerId(id, 'target', resolvedStyle.targetDecoration)})`
      : undefined;

  return (
    <>
      <defs>
        {renderMarkerDef(id, 'source', resolvedStyle.sourceDecoration, resolvedStyle.color)}
        {renderMarkerDef(id, 'target', resolvedStyle.targetDecoration, resolvedStyle.color)}
      </defs>

      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: resolvedStyle.color,
          strokeWidth: resolvedStyle.lineWidth,
          strokeDasharray: getStrokeDasharray(resolvedStyle.lineStyle),
          strokeLinecap: 'round',
          opacity: selected ? 0.85 : 1,
          transition: 'opacity 0.15s',
        }}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />

      {centerLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: resolvedStyle.labelSize,
              color: resolvedStyle.labelColor,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              padding: '1px 4px',
              borderRadius: 3,
              background: 'var(--surface, #1a1a2e)',
              zIndex: 10,
            }}
          >
            {centerLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const VsmEdge = memo(VsmEdgeComponent);
export default VsmEdge;
