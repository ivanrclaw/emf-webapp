/**
 * @emf-webapp/frontend — useCollaborativeModel (Sprint 3)
 *
 * Bridge between useEcoreModel (local state) and useYjsCollaboration (CRDT sync).
 *
 * Architecture (v2 — no useEffect watchers):
 * - Local changes are synced EXPLICITLY via syncLocal() — called by EcoreEditor
 *   after any local mutation (drag end, add/delete, property change).
 * - Remote Y.Doc changes → applied to local model state via onRemoteUpdate callback.
 * - NO useEffect watching nodes/edges — eliminates the echo loop that caused
 *   React error 310 (infinite re-render).
 * - Awareness (cursors, selection) managed via Yjs awareness protocol.
 * - Yjs UndoManager is the PRIMARY undo/redo (per-user scoped).
 */
import { useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useYjsCollaboration, type AwarenessState } from './useYjsCollaboration';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CollaborativeModelOptions {
  /** Metamodel ID (used as room ID) */
  metamodelId: string;
  /** User display name */
  userName: string;
  /** Current nodes from useEcoreModel */
  nodes: Node[];
  /** Current edges from useEcoreModel */
  edges: Edge[];
  /** Callback to apply remote node changes (positions, data) */
  onRemoteNodesChange?: (nodes: Node[]) => void;
  /** Callback to apply remote edge changes */
  onRemoteEdgesChange?: (edges: Edge[]) => void;
}

export interface CollaborativeModelReturn {
  /** Is connected to the collaboration server? */
  connected: boolean;
  /** Remote users' awareness states */
  remoteStates: Map<number, AwarenessState>;
  /** True if this client is the save leader (lowest clientID) */
  isLeader: boolean;
  /** Explicitly sync current local state to Y.Doc — call after local mutations ONLY */
  syncLocal: (nodes: Node[], edges: Edge[]) => void;
  /** Update cursor position (call on mouse move, throttled) */
  setCursor: (position: { x: number; y: number } | null) => void;
  /** Update selection (call when selection changes) */
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  /** Mark a node as being edited */
  setEditingNode: (nodeId: string | null) => void;
  /** Mark a specific field as being edited (soft lock) */
  setEditingField: (field: { nodeId: string; fieldName: string } | null) => void;
  /** Update viewport state for follow mode */
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  /** Send ephemeral cursor chat message */
  setCursorMessage: (text: string | null) => void;
  /** Collaborative undo (only undoes local operations) */
  undo: () => void;
  /** Collaborative redo */
  redo: () => void;
  /** Can undo? */
  canUndo: boolean;
  /** Can redo? */
  canRedo: boolean;
}

// ─── Throttle helper ─────────────────────────────────────────────────────

function useThrottle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  const lastCall = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback((...args: any[]) => {
    const now = Date.now();
    const elapsed = now - lastCall.current;

    if (elapsed >= ms) {
      lastCall.current = now;
      fnRef.current(...args);
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        timerRef.current = null;
        fnRef.current(...args);
      }, ms - elapsed);
    }
  }, [ms]) as T;
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useCollaborativeModel(options: CollaborativeModelOptions): CollaborativeModelReturn {
  const { metamodelId, userName, nodes, edges, onRemoteNodesChange, onRemoteEdgesChange } = options;

  // Track local nodes/edges for merge logic in onRemoteUpdate
  const localNodesRef = useRef<Node[]>(nodes);
  const localEdgesRef = useRef<Edge[]>(edges);
  localNodesRef.current = nodes;
  localEdgesRef.current = edges;

  // Flag: true while applying remote changes — prevents syncLocal from echoing
  const isApplyingRemoteRef = useRef(false);

  const yjs = useYjsCollaboration({
    roomId: metamodelId,
    userName,
    onRemoteUpdate: (remoteNodes: Node[], remoteEdges: Edge[]) => {
      // Guard against re-entrant calls
      if (isApplyingRemoteRef.current) return;
      isApplyingRemoteRef.current = true;

      try {
        if (remoteNodes.length > 0) {
          const localNodes = localNodesRef.current;
          const remoteNodeMap = new Map(remoteNodes.map(n => [n.id, n]));

          const mergedNodes = localNodes.map(localNode => {
            const remote = remoteNodeMap.get(localNode.id);
            if (!remote) return localNode;

            const posChanged = remote.position.x !== localNode.position.x ||
                              remote.position.y !== localNode.position.y;
            const dataChanged = JSON.stringify(remote.data) !== JSON.stringify(localNode.data);

            if (!posChanged && !dataChanged) return localNode;

            return {
              ...localNode,
              position: posChanged ? remote.position : localNode.position,
              data: dataChanged ? remote.data : localNode.data,
            };
          });

          // Add nodes that exist remotely but not locally
          for (const [id, remote] of remoteNodeMap) {
            if (!localNodes.find(n => n.id === id)) {
              mergedNodes.push(remote);
            }
          }

          // Remove nodes that were deleted remotely
          const finalNodes = mergedNodes.filter(n => remoteNodeMap.has(n.id));

          onRemoteNodesChange?.(finalNodes);
        }

        if (remoteEdges.length > 0) {
          const localEdges = localEdgesRef.current;
          const remoteEdgeMap = new Map(remoteEdges.map(e => [e.id, e]));

          const mergedEdges = localEdges.map(localEdge => {
            const remote = remoteEdgeMap.get(localEdge.id);
            if (!remote) return localEdge;

            const dataChanged = JSON.stringify(remote.data) !== JSON.stringify(localEdge.data);
            if (!dataChanged) return localEdge;

            return { ...localEdge, data: remote.data };
          });

          // Add edges that exist remotely but not locally
          for (const [id, remote] of remoteEdgeMap) {
            if (!localEdges.find(e => e.id === id)) {
              mergedEdges.push(remote);
            }
          }

          // Remove edges deleted remotely
          const finalEdges = mergedEdges.filter(e => remoteEdgeMap.has(e.id));

          onRemoteEdgesChange?.(finalEdges);
        }
      } finally {
        // Reset after a full React render cycle — use double rAF to ensure
        // React has committed the state update before we allow local syncs again
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isApplyingRemoteRef.current = false;
          });
        });
      }
    },
    onConnectionChange: (connected: boolean) => {
      if (connected) {
        // On connect, push current state to Y.Doc if Y.Doc is empty
        const nodesMap = yjs.doc.getMap('nodes');
        if (nodesMap.size === 0 && localNodesRef.current.length > 0) {
          yjs.syncNodes(localNodesRef.current);
          yjs.syncEdges(localEdgesRef.current);
        }
      }
    },
  });

  // ── Explicit sync (called by EcoreEditor after local mutations) ────────

  const throttledSyncNodes = useThrottle((n: Node[]) => {
    if (yjs.connected) yjs.syncNodes(n);
  }, 50); // 50ms = ~20fps for drag operations

  const throttledSyncEdges = useThrottle((e: Edge[]) => {
    if (yjs.connected) yjs.syncEdges(e);
  }, 100);

  const syncLocal = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    // Never echo back remote changes
    if (isApplyingRemoteRef.current) return;
    throttledSyncNodes(currentNodes);
    throttledSyncEdges(currentEdges);
  }, [throttledSyncNodes, throttledSyncEdges]);

  // ── Throttled cursor ─────────────────────────────────────────────────

  const throttledSetCursor = useThrottle((pos: { x: number; y: number } | null) => {
    yjs.setCursor(pos);
  }, 33); // ~30fps

  return {
    connected: yjs.connected,
    remoteStates: yjs.remoteStates,
    isLeader: yjs.isLeader,
    syncLocal,
    setCursor: throttledSetCursor,
    setSelection: yjs.setSelection,
    setEditingNode: yjs.setEditingNode,
    setEditingField: yjs.setEditingField,
    setViewport: yjs.setViewport,
    setCursorMessage: yjs.setCursorMessage,
    undo: yjs.undo,
    redo: yjs.redo,
    canUndo: yjs.canUndo,
    canRedo: yjs.canRedo,
  };
}
