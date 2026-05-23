/**
 * @emf-webapp/core — Yjs Document Schema for Collaborative Metamodel Editing
 *
 * Defines the CRDT structure for a metamodel document.
 * Shared between frontend and backend.
 *
 * Schema:
 *   Y.Map("meta")     → { name, nsURI, nsPrefix }
 *   Y.Map("nodes")    → nodeId → Y.Map({ id, type, position: {x,y}, data: {...} })
 *   Y.Map("edges")    → edgeId → Y.Map({ id, source, target, type, data: {...} })
 *   Y.Map("awareness") → managed by Yjs Awareness protocol (cursor, selection, user info)
 */
import * as Y from 'yjs';

// ─── Types ───────────────────────────────────────────────────────────────

export interface YNodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  measured?: { width: number; height: number };
}

export interface YEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  data: Record<string, any>;
}

export interface YMetaData {
  name: string;
  nsURI: string;
  nsPrefix: string;
}

export interface AwarenessState {
  user: {
    name: string;
    color: string;
  };
  cursor: { x: number; y: number } | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  editingNodeId: string | null;
}

// ─── Document Initialization ─────────────────────────────────────────────

/**
 * Initialize a Y.Doc with the metamodel schema structure.
 * Safe to call multiple times — only creates maps if they don't exist.
 */
export function initYDoc(doc: Y.Doc): {
  meta: Y.Map<string>;
  nodes: Y.Map<Y.Map<any>>;
  edges: Y.Map<Y.Map<any>>;
} {
  const meta = doc.getMap('meta') as Y.Map<string>;
  const nodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  const edges = doc.getMap('edges') as Y.Map<Y.Map<any>>;
  return { meta, nodes, edges };
}

// ─── Node Operations ─────────────────────────────────────────────────────

/**
 * Add a node to the Y.Doc. Wraps in a transaction for atomicity.
 */
export function yAddNode(doc: Y.Doc, node: YNodeData): void {
  const nodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  doc.transact(() => {
    const yNode = new Y.Map();
    yNode.set('id', node.id);
    yNode.set('type', node.type);
    yNode.set('position', node.position);
    yNode.set('data', node.data);
    if (node.measured) {
      yNode.set('measured', node.measured);
    }
    nodes.set(node.id, yNode);
  });
}

/**
 * Remove a node from the Y.Doc.
 */
export function yRemoveNode(doc: Y.Doc, nodeId: string): void {
  const nodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  doc.transact(() => {
    nodes.delete(nodeId);
  });
}

/**
 * Update a node's position.
 */
export function yMoveNode(doc: Y.Doc, nodeId: string, position: { x: number; y: number }): void {
  const nodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  const yNode = nodes.get(nodeId);
  if (yNode) {
    doc.transact(() => {
      yNode.set('position', position);
    });
  }
}

/**
 * Update a node's data field.
 */
export function yUpdateNodeData(doc: Y.Doc, nodeId: string, data: Record<string, any>): void {
  const nodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  const yNode = nodes.get(nodeId);
  if (yNode) {
    doc.transact(() => {
      yNode.set('data', data);
    });
  }
}

/**
 * Update a node's measured dimensions.
 */
export function yUpdateNodeMeasured(doc: Y.Doc, nodeId: string, measured: { width: number; height: number }): void {
  const nodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  const yNode = nodes.get(nodeId);
  if (yNode) {
    doc.transact(() => {
      yNode.set('measured', measured);
    });
  }
}

// ─── Edge Operations ─────────────────────────────────────────────────────

/**
 * Add an edge to the Y.Doc.
 */
export function yAddEdge(doc: Y.Doc, edge: YEdgeData): void {
  const edges = doc.getMap('edges') as Y.Map<Y.Map<any>>;
  doc.transact(() => {
    const yEdge = new Y.Map();
    yEdge.set('id', edge.id);
    yEdge.set('source', edge.source);
    yEdge.set('target', edge.target);
    yEdge.set('type', edge.type);
    yEdge.set('data', edge.data);
    edges.set(edge.id, yEdge);
  });
}

/**
 * Remove an edge from the Y.Doc.
 */
export function yRemoveEdge(doc: Y.Doc, edgeId: string): void {
  const edges = doc.getMap('edges') as Y.Map<Y.Map<any>>;
  doc.transact(() => {
    edges.delete(edgeId);
  });
}

/**
 * Update an edge's data.
 */
export function yUpdateEdgeData(doc: Y.Doc, edgeId: string, data: Record<string, any>): void {
  const edges = doc.getMap('edges') as Y.Map<Y.Map<any>>;
  const yEdge = edges.get(edgeId);
  if (yEdge) {
    doc.transact(() => {
      yEdge.set('data', data);
    });
  }
}

// ─── Meta Operations ─────────────────────────────────────────────────────

/**
 * Set metamodel metadata.
 */
export function ySetMeta(doc: Y.Doc, meta: Partial<YMetaData>): void {
  const yMeta = doc.getMap('meta') as Y.Map<string>;
  doc.transact(() => {
    if (meta.name !== undefined) yMeta.set('name', meta.name);
    if (meta.nsURI !== undefined) yMeta.set('nsURI', meta.nsURI);
    if (meta.nsPrefix !== undefined) yMeta.set('nsPrefix', meta.nsPrefix);
  });
}

// ─── Snapshot Helpers ────────────────────────────────────────────────────

/**
 * Convert Y.Doc state to plain objects (for React Flow consumption).
 */
export function yDocToState(doc: Y.Doc): {
  meta: YMetaData;
  nodes: YNodeData[];
  edges: YEdgeData[];
} {
  const yMeta = doc.getMap('meta') as Y.Map<string>;
  const yNodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  const yEdges = doc.getMap('edges') as Y.Map<Y.Map<any>>;

  const meta: YMetaData = {
    name: yMeta.get('name') || '',
    nsURI: yMeta.get('nsURI') || '',
    nsPrefix: yMeta.get('nsPrefix') || '',
  };

  const nodes: YNodeData[] = [];
  yNodes.forEach((yNode) => {
    nodes.push({
      id: yNode.get('id'),
      type: yNode.get('type'),
      position: yNode.get('position'),
      data: yNode.get('data'),
      measured: yNode.get('measured'),
    });
  });

  const edges: YEdgeData[] = [];
  yEdges.forEach((yEdge) => {
    edges.push({
      id: yEdge.get('id'),
      source: yEdge.get('source'),
      target: yEdge.get('target'),
      type: yEdge.get('type'),
      data: yEdge.get('data'),
    });
  });

  return { meta, nodes, edges };
}

/**
 * Load a full state snapshot into a Y.Doc (for initial sync from DB).
 * Clears existing content and replaces with the provided state.
 */
export function loadStateIntoYDoc(
  doc: Y.Doc,
  state: { meta?: Partial<YMetaData>; nodes?: YNodeData[]; edges?: YEdgeData[] },
): void {
  doc.transact(() => {
    const yMeta = doc.getMap('meta') as Y.Map<string>;
    const yNodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
    const yEdges = doc.getMap('edges') as Y.Map<Y.Map<any>>;

    // Clear existing
    yNodes.forEach((_, key) => yNodes.delete(key));
    yEdges.forEach((_, key) => yEdges.delete(key));

    // Load meta
    if (state.meta) {
      if (state.meta.name) yMeta.set('name', state.meta.name);
      if (state.meta.nsURI) yMeta.set('nsURI', state.meta.nsURI);
      if (state.meta.nsPrefix) yMeta.set('nsPrefix', state.meta.nsPrefix);
    }

    // Load nodes
    if (state.nodes) {
      for (const node of state.nodes) {
        const yNode = new Y.Map();
        yNode.set('id', node.id);
        yNode.set('type', node.type);
        yNode.set('position', node.position);
        yNode.set('data', node.data);
        if (node.measured) yNode.set('measured', node.measured);
        yNodes.set(node.id, yNode);
      }
    }

    // Load edges
    if (state.edges) {
      for (const edge of state.edges) {
        const yEdge = new Y.Map();
        yEdge.set('id', edge.id);
        yEdge.set('source', edge.source);
        yEdge.set('target', edge.target);
        yEdge.set('type', edge.type);
        yEdge.set('data', edge.data);
        yEdges.set(edge.id, yEdge);
      }
    }
  });
}

/**
 * Batch move multiple nodes (for multi-select drag).
 */
export function yBatchMoveNodes(
  doc: Y.Doc,
  moves: Array<{ id: string; position: { x: number; y: number } }>,
): void {
  const nodes = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
  doc.transact(() => {
    for (const move of moves) {
      const yNode = nodes.get(move.id);
      if (yNode) {
        yNode.set('position', move.position);
      }
    }
  });
}
