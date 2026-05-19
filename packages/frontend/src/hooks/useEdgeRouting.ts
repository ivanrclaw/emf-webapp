/**
 * @emf-webapp/frontend — useEdgeRouting hook
 *
 * Provides edge group info (source side + target side independently)
 * for edge spreading across all diagram editors.
 *
 * Groups edges by (nodeId, handle/side) — all edges leaving the same
 * source side of a node are spread together regardless of target.
 *
 * @param edgeId - This edge's ID
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param sourceHandle - Source handle ID (e.g. "bottom", "right")
 * @param targetHandle - Target handle ID (e.g. "top", "left")
 */
import { useMemo } from 'react';
import { useEdges } from '@xyflow/react';
import { collectEdgeGroups } from '../lib/edge-routing';
import type { EdgeGroupInfo } from '../lib/edge-routing';

export function useEdgeRouting(
  edgeId: string,
  sourceId: string,
  targetId: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): { groupInfo: EdgeGroupInfo } {
  const edges = useEdges();

  const groupInfo = useMemo(() => {
    const groups = collectEdgeGroups(
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourcePosition: null, // ReactFlow edges don't store it here
        targetPosition: null,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    );
    return groups.get(edgeId) ?? {
      sourceGroupSize: 1,
      sourceGroupIndex: 0,
      targetGroupSize: 1,
      targetGroupIndex: 0,
      pairGroupSize: 1,
      pairGroupIndex: 0,
    };
  }, [edges, edgeId]);

  return { groupInfo };
}
