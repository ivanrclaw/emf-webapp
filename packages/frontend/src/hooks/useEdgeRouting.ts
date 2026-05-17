/**
 * @emf-webapp/frontend — useEdgeRouting hook
 *
 * Provides edge group info and crossing detection for a single edge component,
 * using ReactFlow's useEdges/useNodes to collect all diagram edges.
 */
import { useMemo } from 'react';
import { useEdges, useNodes, Position } from '@xyflow/react';
import { collectEdgeGroups, detectCrossings } from '../lib/edge-routing';
import type { EdgeGroupInfo } from '../lib/edge-routing';

export interface EdgeRoutingResult {
  groupInfo: EdgeGroupInfo;
}

/**
 * Hook that computes edge grouping and crossing info for a specific edge.
 * Call this inside each edge component.
 *
 * @param edgeId - This edge's ID
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param sourceHandle - Source handle ID
 * @param targetHandle - Target handle ID
 * @returns Group info for spreading, and crossings list
 */
export function useEdgeRouting(
  edgeId: string,
  sourceId: string,
  targetId: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): { groupInfo: EdgeGroupInfo } {
  const edges = useEdges();
  const nodes = useNodes();

  const groupInfo = useMemo(() => {
    const groups = collectEdgeGroups(
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    );
    return groups.get(edgeId) ?? { groupSize: 1, groupIndex: 0 };
  }, [edges, edgeId]);

  return { groupInfo };
}

/**
 * Gets node bounding box (position + measured dimensions).
 */
export function getNodeBounds(
  nodeId: string,
  nodes: ReturnType<typeof useNodes>,
): { x: number; y: number; width: number; height: number } | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const measured = (node as any)?.measured;
  return {
    x: node.position.x,
    y: node.position.y,
    width: measured?.width ?? 180,
    height: measured?.height ?? 140,
  };
}
