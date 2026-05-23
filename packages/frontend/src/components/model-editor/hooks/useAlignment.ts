/**
 * @emf-webapp/frontend — useAlignment
 *
 * Hook for alignment and distribution operations on multi-selected nodes.
 * Provides align (snap to edge/center) and distribute (equal spacing) utilities.
 */
import { useCallback, useMemo } from 'react';
import type { Node } from '@xyflow/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeDirection = 'horizontal' | 'vertical';

export interface UseAlignmentReturn {
  align: (nodes: Node[], selectedIds: string[], direction: AlignDirection) => Node[];
  distribute: (nodes: Node[], selectedIds: string[], direction: DistributeDirection) => Node[];
  canAlign: boolean;
  canDistribute: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAlignment(selectedCount: number): UseAlignmentReturn {
  const canAlign = selectedCount >= 2;
  const canDistribute = selectedCount >= 3;

  const align = useCallback(
    (nodes: Node[], selectedIds: string[], direction: AlignDirection): Node[] => {
      if (selectedIds.length < 2) return nodes;

      const selectedSet = new Set(selectedIds);
      const selectedNodes = nodes.filter((n) => selectedSet.has(n.id));

      if (selectedNodes.length < 2) return nodes;

      // Compute target coordinate based on direction
      let target: number;

      switch (direction) {
        case 'left':
          target = Math.min(...selectedNodes.map((n) => n.position.x));
          break;
        case 'center':
          target = Math.min(...selectedNodes.map((n) => n.position.x + NODE_WIDTH / 2));
          break;
        case 'right':
          target = Math.max(...selectedNodes.map((n) => n.position.x + NODE_WIDTH));
          break;
        case 'top':
          target = Math.min(...selectedNodes.map((n) => n.position.y));
          break;
        case 'middle':
          target = Math.min(...selectedNodes.map((n) => n.position.y + NODE_HEIGHT / 2));
          break;
        case 'bottom':
          target = Math.max(...selectedNodes.map((n) => n.position.y + NODE_HEIGHT));
          break;
      }

      // Apply alignment to selected nodes
      return nodes.map((node) => {
        if (!selectedSet.has(node.id)) return node;

        let newX = node.position.x;
        let newY = node.position.y;

        switch (direction) {
          case 'left':
            newX = target;
            break;
          case 'center':
            newX = target - NODE_WIDTH / 2;
            break;
          case 'right':
            newX = target - NODE_WIDTH;
            break;
          case 'top':
            newY = target;
            break;
          case 'middle':
            newY = target - NODE_HEIGHT / 2;
            break;
          case 'bottom':
            newY = target - NODE_HEIGHT;
            break;
        }

        if (newX === node.position.x && newY === node.position.y) return node;
        return { ...node, position: { x: newX, y: newY } };
      });
    },
    [],
  );

  const distribute = useCallback(
    (nodes: Node[], selectedIds: string[], direction: DistributeDirection): Node[] => {
      if (selectedIds.length < 3) return nodes;

      const selectedSet = new Set(selectedIds);
      const selectedNodes = nodes.filter((n) => selectedSet.has(n.id));

      if (selectedNodes.length < 3) return nodes;

      // Sort by position in the distribution axis
      const sorted = [...selectedNodes].sort((a, b) => {
        if (direction === 'horizontal') return a.position.x - b.position.x;
        return a.position.y - b.position.y;
      });

      // Compute equal spacing between first and last
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      let totalSpan: number;
      if (direction === 'horizontal') {
        totalSpan = last.position.x - first.position.x;
      } else {
        totalSpan = last.position.y - first.position.y;
      }

      const step = totalSpan / (sorted.length - 1);

      // Build position map for distributed nodes
      const positionMap = new Map<string, { x: number; y: number }>();
      for (let i = 0; i < sorted.length; i++) {
        const node = sorted[i];
        if (direction === 'horizontal') {
          positionMap.set(node.id, {
            x: first.position.x + step * i,
            y: node.position.y,
          });
        } else {
          positionMap.set(node.id, {
            x: node.position.x,
            y: first.position.y + step * i,
          });
        }
      }

      // Apply new positions
      return nodes.map((node) => {
        const newPos = positionMap.get(node.id);
        if (!newPos) return node;
        if (newPos.x === node.position.x && newPos.y === node.position.y) return node;
        return { ...node, position: newPos };
      });
    },
    [],
  );

  return useMemo(
    () => ({ align, distribute, canAlign, canDistribute }),
    [align, distribute, canAlign, canDistribute],
  );
}
