/**
 * @emf-webapp/frontend — useCollaborativeModel (Sprint 3)
 *
 * Bridge between useEcoreModel (local state) and useYjsCollaboration (CRDT sync).
 *
 * Strategy:
 * - Local changes (node moves, adds, deletes) → pushed to Y.Doc as atomic ops
 * - Remote Y.Doc changes → applied to local model state (positions, data)
 * - Awareness (cursors, selection) managed via Yjs awareness protocol
 * - Yjs UndoManager is the PRIMARY undo/redo (per-user scoped)
 *
 * This hook wraps around the existing useEcoreModel return value and
 * adds collaborative sync without modifying the core model hook.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
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

  // Track whether we're applying remote changes (to avoid echo)
  const isApplyingRemoteRef = useRef(false);
  // Track previous state to detect actual changes
  const prevNodesFingerprintRef = useRef<string>('');
  const prevEdgesFingerprintRef = useRef<string>('');
  // Track local nodes/edges for initial sync
  const localNodesRef = useRef<Node[]>(nodes);
  const localEdgesRef = useRef<Edge[]>(edges);
  localNodesRef.current = nodes;
  localEdgesRef.current = edges;

  const yjs = useYjsCollaboration({
    roomId: metamodelId,
    userName,
    onRemoteUpdate: (remoteNodes: Node[], remoteEdges: Edge[]) => {
      if (isApplyingRemoteRef.current) return;

      // Apply remote changes to local state
      isApplyingRemoteRef.current = true;

      if (remoteNodes.length > 0) {
        // Merge remote positions/data into local nodes
        const localNodes = localNodesRef.current;
        const remoteNodeMap = new Map(remoteNodes.map(n => [n.id, n]));

        const mergedNodes = localNodes.map(localNode => {
          const remote = remoteNodeMap.get(localNode.id);
          if (!remote) return localNode;

          // Update position and data from remote
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

      // Reset flag after a tick (to allow React to process)
      setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
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

  // ── Sync local changes to Y.Doc ──────────────────────────────────────

  // Throttled sync to avoid flooding during drag operations
  const throttledSyncNodes = useThrottle((n: Node[]) => {
    if (!isApplyingRemoteRef.current && yjs.connected) {
      yjs.syncNodes(n);
    }
  }, 50); // 50ms = ~20fps for drag operations

  const throttledSyncEdges = useThrottle((e: Edge[]) => {
    if (!isApplyingRemoteRef.current && yjs.connected) {
      yjs.syncEdges(e);
    }
  }, 100);

  // Watch for node changes
  useEffect(() => {
    if (isApplyingRemoteRef.current) return;

    // Quick fingerprint to avoid unnecessary syncs
    const fingerprint = nodes.map(n =>
      `${n.id}:${n.position.x}:${n.position.y}:${JSON.stringify(n.data?.name || '')}`
    ).join('|');
    if (fingerprint === prevNodesFingerprintRef.current) return;
    prevNodesFingerprintRef.current = fingerprint;

    throttledSyncNodes(nodes);
  }, [nodes, throttledSyncNodes]);

  // Watch for edge changes
  useEffect(() => {
    if (isApplyingRemoteRef.current) return;

    const fingerprint = edges.map((e: any) => `${e.id}:${e.source}:${e.target}`).join('|');
    if (fingerprint === prevEdgesFingerprintRef.current) return;
    prevEdgesFingerprintRef.current = fingerprint;

    throttledSyncEdges(edges);
  }, [edges, throttledSyncEdges]);

  // ── Throttled cursor ─────────────────────────────────────────────────

  const throttledSetCursor = useThrottle((pos: { x: number; y: number } | null) => {
    yjs.setCursor(pos);
  }, 33); // ~30fps

  return {
    connected: yjs.connected,
    remoteStates: yjs.remoteStates,
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
