/**
 * @emf-webapp/frontend — Auto-Layout using Dagre (Hierarchy-Aware)
 *
 * Applies a hierarchical layout that respects EMF metamodel semantics:
 *
 *   - Inheritance: parent classes are placed ABOVE children (highest priority).
 *     Edges are reversed in dagre so that the hierarchy flows naturally top→bottom.
 *
 *   - Containment: containers are placed near their contained elements with
 *     medium priority, encouraging visual grouping.
 *
 *   - References: lowest priority — they influence layout but don't force hierarchy.
 *
 * Edge weights and minimum rank separation are tuned per relationship type
 * to produce clean, readable diagrams similar to Eclipse Ecore Tools.
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
  nodeHeight: 140,
  rankSep: 55,
  nodeSep: 35,
};

/**
 * Edge weight configuration per relationship type.
 * Higher weight = dagre tries harder to keep the edge short and straight.
 * minlen = minimum number of ranks between connected nodes.
 */
const EDGE_CONFIG: Record<string, { weight: number; minlen: number }> = {
  inheritanceEdge: { weight: 10, minlen: 1 },
  containmentEdge: { weight: 5, minlen: 1 },
  referenceEdge: { weight: 1, minlen: 1 },
};

/**
 * Compute auto-layout positions for a set of nodes and edges.
 * Returns a Map of nodeId → { x, y } positions.
 *
 * Inheritance edges are reversed in the dagre graph so that parent classes
 * end up in higher ranks (visually above children in TB, or to the left in LR).
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
    marginx: 20,
    marginy: 20,
    // Use network-simplex for better hierarchy handling
    ranker: 'network-simplex',
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with their measured or default dimensions
  for (const node of nodes) {
    const measured = (node as any)?.measured;
    const w = measured?.width ?? opts.nodeWidth;
    const h = measured?.height ?? opts.nodeHeight;
    g.setNode(node.id, { width: w, height: h });
  }

  // Add edges with type-aware weights
  for (const edge of edges) {
    const edgeType = (edge.type as string) || 'referenceEdge';
    const config = EDGE_CONFIG[edgeType] ?? EDGE_CONFIG.referenceEdge;

    if (edgeType === 'inheritanceEdge') {
      // REVERSE inheritance edges: in our model edge goes child→parent,
      // but dagre should place parent in a higher rank (above child in TB).
      // By reversing (parent→child), dagre naturally puts parent above.
      g.setEdge(edge.target, edge.source, {
        weight: config.weight,
        minlen: config.minlen,
      });
    } else {
      // Containment and references: source (container/owner) → target
      // In TB mode this places the container above or at the same level
      g.setEdge(edge.source, edge.target, {
        weight: config.weight,
        minlen: config.minlen,
      });
    }
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
