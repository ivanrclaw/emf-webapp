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
// ─── Document Initialization ─────────────────────────────────────────────
/**
 * Initialize a Y.Doc with the metamodel schema structure.
 * Safe to call multiple times — only creates maps if they don't exist.
 */
export function initYDoc(doc) {
    const meta = doc.getMap('meta');
    const nodes = doc.getMap('nodes');
    const edges = doc.getMap('edges');
    return { meta, nodes, edges };
}
// ─── Node Operations ─────────────────────────────────────────────────────
/**
 * Add a node to the Y.Doc. Wraps in a transaction for atomicity.
 */
export function yAddNode(doc, node) {
    const nodes = doc.getMap('nodes');
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
export function yRemoveNode(doc, nodeId) {
    const nodes = doc.getMap('nodes');
    doc.transact(() => {
        nodes.delete(nodeId);
    });
}
/**
 * Update a node's position.
 */
export function yMoveNode(doc, nodeId, position) {
    const nodes = doc.getMap('nodes');
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
export function yUpdateNodeData(doc, nodeId, data) {
    const nodes = doc.getMap('nodes');
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
export function yUpdateNodeMeasured(doc, nodeId, measured) {
    const nodes = doc.getMap('nodes');
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
export function yAddEdge(doc, edge) {
    const edges = doc.getMap('edges');
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
export function yRemoveEdge(doc, edgeId) {
    const edges = doc.getMap('edges');
    doc.transact(() => {
        edges.delete(edgeId);
    });
}
/**
 * Update an edge's data.
 */
export function yUpdateEdgeData(doc, edgeId, data) {
    const edges = doc.getMap('edges');
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
export function ySetMeta(doc, meta) {
    const yMeta = doc.getMap('meta');
    doc.transact(() => {
        if (meta.name !== undefined)
            yMeta.set('name', meta.name);
        if (meta.nsURI !== undefined)
            yMeta.set('nsURI', meta.nsURI);
        if (meta.nsPrefix !== undefined)
            yMeta.set('nsPrefix', meta.nsPrefix);
    });
}
// ─── Snapshot Helpers ────────────────────────────────────────────────────
/**
 * Convert Y.Doc state to plain objects (for React Flow consumption).
 */
export function yDocToState(doc) {
    const yMeta = doc.getMap('meta');
    const yNodes = doc.getMap('nodes');
    const yEdges = doc.getMap('edges');
    const meta = {
        name: yMeta.get('name') || '',
        nsURI: yMeta.get('nsURI') || '',
        nsPrefix: yMeta.get('nsPrefix') || '',
    };
    const nodes = [];
    yNodes.forEach((yNode) => {
        nodes.push({
            id: yNode.get('id'),
            type: yNode.get('type'),
            position: yNode.get('position'),
            data: yNode.get('data'),
            measured: yNode.get('measured'),
        });
    });
    const edges = [];
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
export function loadStateIntoYDoc(doc, state) {
    doc.transact(() => {
        const yMeta = doc.getMap('meta');
        const yNodes = doc.getMap('nodes');
        const yEdges = doc.getMap('edges');
        // Clear existing
        yNodes.forEach((_, key) => yNodes.delete(key));
        yEdges.forEach((_, key) => yEdges.delete(key));
        // Load meta
        if (state.meta) {
            if (state.meta.name)
                yMeta.set('name', state.meta.name);
            if (state.meta.nsURI)
                yMeta.set('nsURI', state.meta.nsURI);
            if (state.meta.nsPrefix)
                yMeta.set('nsPrefix', state.meta.nsPrefix);
        }
        // Load nodes
        if (state.nodes) {
            for (const node of state.nodes) {
                const yNode = new Y.Map();
                yNode.set('id', node.id);
                yNode.set('type', node.type);
                yNode.set('position', node.position);
                yNode.set('data', node.data);
                if (node.measured)
                    yNode.set('measured', node.measured);
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
export function yBatchMoveNodes(doc, moves) {
    const nodes = doc.getMap('nodes');
    doc.transact(() => {
        for (const move of moves) {
            const yNode = nodes.get(move.id);
            if (yNode) {
                yNode.set('position', move.position);
            }
        }
    });
}
//# sourceMappingURL=yjs-schema.js.map