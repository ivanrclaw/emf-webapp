/**
 * @emf-webapp/frontend — useCollaborativeModel
 *
 * Bridge between useEcoreModel (local state) and useYjsCollaboration (CRDT sync).
 *
 * Strategy:
 * - Local changes (node moves, adds, deletes) → pushed to Y.Doc
 * - Remote Y.Doc changes → applied to local model state
 * - Awareness (cursors, selection) managed via Yjs awareness protocol
 * - Replaces the old Socket.IO "model-changed" full-blob approach
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
  edges: Node[];
  /** Callback to apply remote node changes */
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
  const prevNodesRef = useRef<string>('');
  const prevEdgesRef = useRef<string>('');

  const yjs = useYjsCollaboration({
    roomId: metamodelId,
    userName,
    onRemoteUpdate: (remoteNodes: Node[], remoteEdges: Edge[]) => {
      // Remote changes arrived — apply to local model
      isApplyingRemoteRef.current = true;
      onRemoteNodesChange?.(remoteNodes);
      onRemoteEdgesChange?.(remoteEdges);
      // Reset flag after a tick (to allow React to process)
      setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
    },
    onConnectionChange: (connected: boolean) => {
      if (connected) {
        // On connect, push current state to Y.Doc (initial sync)
        // Only if we have content and Y.Doc is empty
        const nodesMap = yjs.doc.getMap('nodes');
        if (nodesMap.size === 0 && nodes.length > 0) {
          yjs.syncNodes(nodes);
          yjs.syncEdges(edges as any);
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
    const fingerprint = nodes.map(n => `${n.id}:${n.position.x}:${n.position.y}`).join('|');
    if (fingerprint === prevNodesRef.current) return;
    prevNodesRef.current = fingerprint;

    throttledSyncNodes(nodes);
  }, [nodes, throttledSyncNodes]);

  // Watch for edge changes
  useEffect(() => {
    if (isApplyingRemoteRef.current) return;

    const fingerprint = edges.map((e: any) => `${e.id}:${e.source}:${e.target}`).join('|');
    if (fingerprint === prevEdgesRef.current) return;
    prevEdgesRef.current = fingerprint;

    throttledSyncEdges(edges as any);
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
    undo: yjs.undo,
    redo: yjs.redo,
    canUndo: yjs.canUndo,
    canRedo: yjs.canRedo,
  };
}
