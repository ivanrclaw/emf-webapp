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
export interface YNodeData {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    data: Record<string, any>;
    measured?: {
        width: number;
        height: number;
    };
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
    cursor: {
        x: number;
        y: number;
    } | null;
    selectedNodeIds: string[];
    selectedEdgeIds: string[];
    editingNodeId: string | null;
}
/**
 * Initialize a Y.Doc with the metamodel schema structure.
 * Safe to call multiple times — only creates maps if they don't exist.
 */
export declare function initYDoc(doc: Y.Doc): {
    meta: Y.Map<string>;
    nodes: Y.Map<Y.Map<any>>;
    edges: Y.Map<Y.Map<any>>;
};
/**
 * Add a node to the Y.Doc. Wraps in a transaction for atomicity.
 */
export declare function yAddNode(doc: Y.Doc, node: YNodeData): void;
/**
 * Remove a node from the Y.Doc.
 */
export declare function yRemoveNode(doc: Y.Doc, nodeId: string): void;
/**
 * Update a node's position.
 */
export declare function yMoveNode(doc: Y.Doc, nodeId: string, position: {
    x: number;
    y: number;
}): void;
/**
 * Update a node's data field.
 */
export declare function yUpdateNodeData(doc: Y.Doc, nodeId: string, data: Record<string, any>): void;
/**
 * Update a node's measured dimensions.
 */
export declare function yUpdateNodeMeasured(doc: Y.Doc, nodeId: string, measured: {
    width: number;
    height: number;
}): void;
/**
 * Add an edge to the Y.Doc.
 */
export declare function yAddEdge(doc: Y.Doc, edge: YEdgeData): void;
/**
 * Remove an edge from the Y.Doc.
 */
export declare function yRemoveEdge(doc: Y.Doc, edgeId: string): void;
/**
 * Update an edge's data.
 */
export declare function yUpdateEdgeData(doc: Y.Doc, edgeId: string, data: Record<string, any>): void;
/**
 * Set metamodel metadata.
 */
export declare function ySetMeta(doc: Y.Doc, meta: Partial<YMetaData>): void;
/**
 * Convert Y.Doc state to plain objects (for React Flow consumption).
 */
export declare function yDocToState(doc: Y.Doc): {
    meta: YMetaData;
    nodes: YNodeData[];
    edges: YEdgeData[];
};
/**
 * Load a full state snapshot into a Y.Doc (for initial sync from DB).
 * Clears existing content and replaces with the provided state.
 */
export declare function loadStateIntoYDoc(doc: Y.Doc, state: {
    meta?: Partial<YMetaData>;
    nodes?: YNodeData[];
    edges?: YEdgeData[];
}): void;
/**
 * Batch move multiple nodes (for multi-select drag).
 */
export declare function yBatchMoveNodes(doc: Y.Doc, moves: Array<{
    id: string;
    position: {
        x: number;
        y: number;
    };
}>): void;
//# sourceMappingURL=yjs-schema.d.ts.map