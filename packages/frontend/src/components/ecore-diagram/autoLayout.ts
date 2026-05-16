/**
 * @emf-webapp/frontend — Auto-Layout using Dagre
 *
 * Applies a hierarchical layout (top-bottom or left-right) to the diagram nodes
 * using the dagre graph layout library. Respects node dimensions for proper spacing.
 */
import * as dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  direction: 'TB',
  nodeWidth: 200,
  nodeHeight: 160,
  rankSep: 80,
  nodeSep: 60,
};

/**
 * Compute auto-layout positions for a set of nodes and edges.
 * Returns a Map of nodeId → { x, y } positions.
 */
export function computeAutoLayout(
  nodes: Node[],
  edges: Edge[],
  options?: LayoutOptions,
): Map<string, { x: number; y: number }> {
  const opts = { ...DEFAULTS, ...options };
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with their measured or default dimensions
  for (const node of nodes) {
    const measured = (node as any)?.measured;
    const w = measured?.width ?? opts.nodeWidth;
    const h = measured?.height ?? opts.nodeHeight;
    g.setNode(node.id, { width: w, height: h });
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run layout
  dagre.layout(g);

  // Extract positions (dagre gives center coords, React Flow uses top-left)
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      const measured = (node as any)?.measured;
      const w = measured?.width ?? opts.nodeWidth;
      const h = measured?.height ?? opts.nodeHeight;
      positions.set(node.id, {
        x: dagreNode.x - w / 2,
        y: dagreNode.y - h / 2,
      });
    }
  }

  return positions;
}
