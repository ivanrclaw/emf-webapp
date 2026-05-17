/**
 * @emf-webapp/frontend — VsmEdge: Custom ReactFlow Edge for VSM Runtime
 *
 * Renders edges according to the resolved EdgeStyleSpec from the viewpoint specification.
 * Supports edge spreading: all edges from the same source side are spread independently
 * of their targets, preventing visual overlap.
 */
import React, { memo, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  useNodes,
  type EdgeProps,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { EdgeMapping, EdgeStyleSpec } from '../spec-diagram/types';
import { resolveEdgeStyle } from '../../lib/vsm-runtime';
import { evaluateLabel } from '../../lib/expression-engine';
import { useEdgeRouting } from '../../hooks/useEdgeRouting';
import { spreadHandlePosition } from '../../lib/edge-routing';
import { CrossingBridges } from '../shared/CrossingBridges';

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

function getMarkerId(edgeId: string, position: 'source' | 'target', decoration: string): string {
  return `vsm-marker-${edgeId}-${position}-${decoration}`;
}

function renderMarkerDef(
  edgeId: string,
  position: 'source' | 'target',
  decoration: string,
  color: string,
): React.ReactNode {
  if (decoration === 'none') return null;
  const id = getMarkerId(edgeId, position, decoration);
  const isSource = position === 'source';
  switch (decoration) {
    case 'arrow':
      return (
        <marker key={id} id={id} viewBox="0 0 12 12" refX={isSource ? 2 : 10} refY={6}
          markerWidth={10} markerHeight={10} orient="auto">
          <path d="M 1 1 L 11 6 L 1 11 Z" fill={color} />
        </marker>
      );
    case 'open-arrow':
      return (
        <marker key={id} id={id} viewBox="0 0 12 12" refX={isSource ? 2 : 10} refY={6}
          markerWidth={10} markerHeight={10} orient="auto">
          <path d="M 1 1 L 11 6 L 1 11" fill="none" stroke={color} strokeWidth={1.5} />
        </marker>
      );
    case 'diamond':
      return (
        <marker key={id} id={id} viewBox="0 0 14 14" refX={isSource ? 0 : 14} refY={7}
          markerWidth={12} markerHeight={12} orient="auto">
          <polygon points="7,0 14,7 7,14 0,7" fill="none" stroke={color} strokeWidth={1.5} />
        </marker>
      );
    case 'filled-diamond':
      return (
        <marker key={id} id={id} viewBox="0 0 14 14" refX={isSource ? 0 : 14} refY={7}
          markerWidth={12} markerHeight={12} orient="auto">
          <polygon points="7,0 14,7 7,14 0,7" fill={color} stroke={color} strokeWidth={1} />
        </marker>
      );
    case 'triangle':
      return (
        <marker key={id} id={id} viewBox="0 0 14 14" refX={isSource ? 2 : 12} refY={7}
          markerWidth={12} markerHeight={12} orient="auto">
          <polygon points="2,1 12,7 2,13" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        </marker>
      );
    case 'filled-triangle':
      return (
        <marker key={id} id={id} viewBox="0 0 14 14" refX={isSource ? 2 : 12} refY={7}
          markerWidth={12} markerHeight={12} orient="auto">
          <polygon points="2,1 12,7 2,13" fill={color} strokeLinejoin="round" />
        </marker>
      );
    default:
      return null;
  }
}

// ─── Side from handle ─────────────────────────────────────────────────────────

function sideFromHandle(handle: string | null | undefined): 'left' | 'right' | 'top' | 'bottom' {
  if (handle === 'top' || handle === 'bottom' || handle === 'left' || handle === 'right') {
    return handle;
  }
  // Position enum values used by ReactFlow
  if (handle === '0') return 'left';
  if (handle === '1') return 'top';
  if (handle === '2') return 'right';
  if (handle === '3') return 'bottom';
  return 'right'; // default
}

// ─── VsmEdge Component ────────────────────────────────────────────────────────

function VsmEdgeComponent(props: EdgeProps<Edge<VsmEdgeData>>) {
  const {
    id,
    data,
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    selected,
    source: srcId,
    target: tgtId,
  } = props;

  // sourceHandle/targetHandle from edge data or props
  const sourceHandle = (props as any).sourceHandle ?? (props as any).sourceHandleId;
  const targetHandle = (props as any).targetHandle ?? (props as any).targetHandleId;

  const edgeMapping = data?.edgeMapping;
  const sourceData = data?.sourceData;
  const targetData = data?.targetData;

  // Edge routing: group by source side AND target side independently
  const { groupInfo } = useEdgeRouting(id, srcId, tgtId, sourceHandle, targetHandle);

  // Resolve effective style
  const resolvedStyle: EdgeStyleSpec = useMemo(() => {
    if (!edgeMapping) {
      return {
        lineStyle: 'solid', lineWidth: 2, color: '#6366f1',
        sourceDecoration: 'none', targetDecoration: 'arrow',
        routingStyle: 'manhattan', labelColor: '#a1a1aa', labelSize: 11,
      } as EdgeStyleSpec;
    }
    return resolveEdgeStyle(edgeMapping, { source: sourceData, target: targetData });
  }, [edgeMapping, sourceData, targetData]);

  // Apply spreading on BOTH source and target sides independently
  const nodes = useNodes();
  const sNode = nodes.find((n) => n.id === srcId);
  const tNode = nodes.find((n) => n.id === tgtId);

  const { effSourceX, effSourceY, effTargetX, effTargetY } = useMemo(() => {
    if (!sNode || !tNode) {
      return { effSourceX: sourceX, effSourceY: sourceY, effTargetX: targetX, effTargetY: targetY };
    }

    const sMeas = (sNode as any)?.measured;
    const tMeas = (tNode as any)?.measured;
    const sW = sMeas?.width ?? 160;
    const sH = sMeas?.height ?? 64;
    const tW = tMeas?.width ?? 160;
    const tH = tMeas?.height ?? 64;

    const srcSide = sideFromHandle(sourceHandle);
    const tgtSide = sideFromHandle(targetHandle);

    // Source side spreading: all edges from this side are spread together
    const sp = spreadHandlePosition(
      srcSide, groupInfo.sourceGroupSize, groupInfo.sourceGroupIndex,
      sNode.position.x, sNode.position.y, sW, sH,
    );

    // Target side spreading: all edges to this side are spread together
    const tp = spreadHandlePosition(
      tgtSide, groupInfo.targetGroupSize, groupInfo.targetGroupIndex,
      tNode.position.x, tNode.position.y, tW, tH,
    );

    return { effSourceX: sp.x, effSourceY: sp.y, effTargetX: tp.x, effTargetY: tp.y };
  }, [sNode, tNode, sourceHandle, targetHandle, sourceX, sourceY, targetX, targetY, groupInfo]);

  // Compute path based on routing style
  const [edgePath, labelX, labelY] = useMemo(() => {
    const result = resolvedStyle.routingStyle === 'straight'
      ? getBezierPath({ sourceX: effSourceX, sourceY: effSourceY, sourcePosition, targetX: effTargetX, targetY: effTargetY, targetPosition })
      : getSmoothStepPath({ sourceX: effSourceX, sourceY: effSourceY, sourcePosition, targetX: effTargetX, targetY: effTargetY, targetPosition });
    return [result[0], result[1], result[2]];
  }, [resolvedStyle.routingStyle, effSourceX, effSourceY, sourcePosition, effTargetX, effTargetY, targetPosition]);

  // Evaluate center label expression
  const centerLabel = useMemo(() => {
    if (!resolvedStyle.centerLabelExpression) return '';
    const ctx = sourceData ?? {};
    return evaluateLabel(resolvedStyle.centerLabelExpression, { self: ctx });
  }, [resolvedStyle.centerLabelExpression, sourceData]);

  const markerStart = resolvedStyle.sourceDecoration !== 'none'
    ? `url(#${getMarkerId(id, 'source', resolvedStyle.sourceDecoration)})`
    : undefined;

  const markerEnd = resolvedStyle.targetDecoration !== 'none'
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

      <CrossingBridges edgeId={id} crossings={[]} />

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
