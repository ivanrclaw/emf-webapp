/**
 * @emf-webapp/frontend — useYjsCollaboration
 *
 * React hook that connects to the Yjs WebSocket server and syncs
 * the Y.Doc CRDT state with React Flow nodes/edges.
 *
 * Production-grade presence management:
 * - Stable session identity via sessionStorage (F5 reuses same identity)
 * - Heartbeat protocol (responds to server pings, sends own heartbeats)
 * - Proper cleanup on unmount, beforeunload, and visibilitychange
 * - New Y.Doc per connection cycle (no stale clientID reuse)
 */
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Node, Edge } from '@xyflow/react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface AwarenessUser {
  name: string;
  color: string;
}

export interface AwarenessState {
  user: AwarenessUser;
  cursor: { x: number; y: number } | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  editingNodeId: string | null;
  /** Field-level lock: which field the user is actively editing */
  editingField: { nodeId: string; fieldName: string } | null;
  /** Viewport state for follow mode */
  viewport: { x: number; y: number; zoom: number } | null;
  /** Ephemeral cursor chat message */
  cursorMessage: { text: string; timestamp: number } | null;
}

export interface YjsCollaborationOptions {
  /** Room ID (typically metamodelId) */
  roomId: string;
  /** User display name */
  userName: string;
  /** User color (auto-assigned if not provided) */
  userColor?: string;
  /** Called when remote changes arrive (new nodes/edges state) */
  onRemoteUpdate?: (nodes: Node[], edges: Edge[]) => void;
  /** Called when awareness changes (other users' cursors, selections) */
  onAwarenessUpdate?: (states: Map<number, AwarenessState>) => void;
  /** Called on connection state change */
  onConnectionChange?: (connected: boolean) => void;
}

export interface YjsCollaborationReturn {
  /** Connection status */
  connected: boolean;
  /** The Y.Doc instance (for direct access if needed) */
  doc: Y.Doc;
  /** Awareness instance */
  awareness: awarenessProtocol.Awareness;
  /** Push local node changes to Y.Doc */
  syncNodes: (nodes: Node[]) => void;
  /** Push local edge changes to Y.Doc */
  syncEdges: (edges: Edge[]) => void;
  /** Update local cursor position in awareness */
  setCursor: (position: { x: number; y: number } | null) => void;
  /** Update local selection in awareness */
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  /** Mark a node as being edited by this user */
  setEditingNode: (nodeId: string | null) => void;
  /** Mark a specific field as being edited (soft lock) */
  setEditingField: (field: { nodeId: string; fieldName: string } | null) => void;
  /** Update viewport state for follow mode */
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  /** Send ephemeral cursor chat message */
  setCursorMessage: (text: string | null) => void;
  /** Other users' awareness states */
  remoteStates: Map<number, AwarenessState>;
  /** True if this client is the save leader (lowest clientID) */
  isLeader: boolean;
  /** Undo last local operation */
  undo: () => void;
  /** Redo last undone operation */
  redo: () => void;
  /** Can undo? */
  canUndo: boolean;
  /** Can redo? */
  canRedo: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_HEARTBEAT = 2;

/** Client sends heartbeat every 10s (server TTL is 30s, so 3x margin) */
const CLIENT_HEARTBEAT_INTERVAL_MS = 10_000;

const USER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ec4899',
  '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6',
];

function getAutoColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// ─── Stable Session Identity ─────────────────────────────────────────────
// Persists across F5 within the same tab, but unique per tab.
// This ensures that refreshing doesn't create a new "user" — the server
// will see the same identity reconnecting and clean up the old state.

function getSessionUserName(baseName: string): string {
  const key = 'emf-collab-session-name';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  // Generate a stable name for this tab session
  const suffix = Math.random().toString(36).slice(2, 6);
  const name = baseName === 'Anonymous' ? `User-${suffix}` : baseName;
  sessionStorage.setItem(key, name);
  return name;
}

function getSessionColor(): string {
  const key = 'emf-collab-session-color';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  sessionStorage.setItem(key, color);
  return color;
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useYjsCollaboration(options: YjsCollaborationOptions): YjsCollaborationReturn {
  const { roomId } = options;

  const [connected, setConnected] = useState(false);
  const [remoteStates, setRemoteStates] = useState<Map<number, AwarenessState>>(new Map());
  const remoteStatesRef = useRef<Map<number, AwarenessState>>(remoteStates);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Stable refs
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Y.Doc and awareness — created fresh per connection cycle
  const docRef = useRef<Y.Doc>(new Y.Doc());
  const awarenessRef = useRef<awarenessProtocol.Awareness>(
    new awarenessProtocol.Awareness(docRef.current)
  );
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLocalUpdateRef = useRef(false);
  const idbRef = useRef<IndexeddbPersistence | null>(null);
  const cleanedUpRef = useRef(false);

  const doc = docRef.current;
  const awareness = awarenessRef.current;

  // IndexedDB persistence — survives page reloads and offline edits
  useEffect(() => {
    if (!roomId) return;
    const idb = new IndexeddbPersistence(`emf-collab-${roomId}`, doc);
    idbRef.current = idb;

    return () => {
      idb.destroy();
      idbRef.current = null;
    };
  }, [roomId, doc]);

  // Initialize UndoManager scoped to nodes and edges maps
  useEffect(() => {
    const nodesMap = doc.getMap('nodes');
    const edgesMap = doc.getMap('edges');
    const um = new Y.UndoManager([nodesMap, edgesMap], {
      trackedOrigins: new Set(['local']),
    });
    undoManagerRef.current = um;

    const updateUndoState = () => {
      setCanUndo(um.canUndo());
      setCanRedo(um.canRedo());
    };
    um.on('stack-item-added', updateUndoState);
    um.on('stack-item-popped', updateUndoState);

    return () => {
      um.destroy();
      undoManagerRef.current = null;
    };
  }, [doc]);

  // WebSocket connection with heartbeat
  useEffect(() => {
    if (!roomId) return;

    let destroyed = false;
    cleanedUpRef.current = false;

    // Resolve stable identity for this tab
    const userName = getSessionUserName(optionsRef.current.userName);
    const userColor = optionsRef.current.userColor || getSessionColor();

    function sendHeartbeat(ws: WebSocket) {
      if (ws.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_HEARTBEAT);
        ws.send(encoding.toUint8Array(encoder));
      }
    }

    function cleanupAwareness() {
      if (cleanedUpRef.current) return;
      cleanedUpRef.current = true;
      try {
        awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], 'cleanup');
      } catch {
        // Ignore errors during cleanup
      }
    }

    function connect() {
      if (destroyed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/yjs?room=${encodeURIComponent(roomId)}`;
      console.log('[Yjs] Connecting to', wsUrl);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        cleanedUpRef.current = false;
        setConnected(true);
        console.log('[Yjs] Connected! clientID=', doc.clientID);
        optionsRef.current.onConnectionChange?.(true);

        // Set awareness state with stable identity.
        // IMPORTANT: Use setLocalState (not setLocalStateField) because after
        // removeAwarenessStates the local state is null, and setLocalStateField
        // is a no-op when localState === null.
        awareness.setLocalState({
          user: { name: userName, color: userColor },
          cursor: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
          editingNodeId: null,
          editingField: null,
          viewport: null,
          cursorMessage: null,
        });

        // Start client heartbeat — sends every 10s to keep alive on server
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => sendHeartbeat(ws), CLIENT_HEARTBEAT_INTERVAL_MS);
        // Send first heartbeat immediately
        sendHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data as ArrayBuffer);
        const decoder = decoding.createDecoder(data);
        const msgType = decoding.readVarUint(decoder);

        switch (msgType) {
          case MSG_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, encoder, doc, null);
            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case MSG_AWARENESS: {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
            break;
          }
          case MSG_HEARTBEAT: {
            // Server sent a heartbeat ping — respond immediately
            sendHeartbeat(ws);
            break;
          }
        }
      };

      ws.onclose = (event) => {
        if (destroyed) return;
        console.log('[Yjs] WS closed, code=', event.code, 'reason=', event.reason);
        setConnected(false);
        optionsRef.current.onConnectionChange?.(false);
        wsRef.current = null;

        // Stop heartbeat
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        // Reconnect after delay
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error('[Yjs] WS error', err);
        ws.close();
      };
    }

    connect();

    // Listen for local doc updates → send to server
    const onDocUpdate = (update: Uint8Array, origin: any) => {
      if (origin === 'remote') return; // Don't echo remote updates
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        ws.send(encoding.toUint8Array(encoder));
      }
    };
    doc.on('update', onDocUpdate);

    // Clean up awareness on page unload (tab close / F5)
    // Belt-and-suspenders: server will also sweep via heartbeat TTL
    const onBeforeUnload = () => {
      cleanupAwareness();
      // Try to send the removal before the page unloads
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]),
        );
        ws.send(encoding.toUint8Array(encoder));
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Also handle visibility change — when tab is hidden for too long,
    // proactively send heartbeat to prevent server sweep
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible again — send heartbeat immediately
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendHeartbeat(ws);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Listen for awareness changes → send to server
    const onAwarenessChange = ({ added, updated, removed }: any) => {
      const changedClients = [...added, ...updated, ...removed];
      if (added.length > 0 || removed.length > 0) {
        console.log('[Yjs] Awareness change: added=', added, 'removed=', removed, 'total states=', awareness.getStates().size);
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
        );
        ws.send(encoding.toUint8Array(encoder));
      }

      // Update remote states for React — only if actually changed
      const states = new Map<number, AwarenessState>();
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== doc.clientID && state.user) {
          states.set(clientId, state as AwarenessState);
        }
      });
      // Shallow compare: only update if keys or values differ
      const prev = remoteStatesRef.current;
      let changed = states.size !== prev.size;
      if (!changed) {
        for (const [id, state] of states) {
          if (!prev.has(id) || prev.get(id) !== state) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        remoteStatesRef.current = states;
        setRemoteStates(states);
      }
      optionsRef.current.onAwarenessUpdate?.(states);
    };
    awareness.on('change', onAwarenessChange);

    // Listen for remote Y.Doc changes → notify React
    const onDocObserve = () => {
      if (isLocalUpdateRef.current) return;
      // Convert Y.Doc state to React Flow format
      const nodesMap = doc.getMap('nodes') as Y.Map<Y.Map<any>>;
      const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<any>>;

      const nodes: Node[] = [];
      nodesMap.forEach((yNode) => {
        nodes.push({
          id: yNode.get('id'),
          type: yNode.get('type'),
          position: yNode.get('position'),
          data: yNode.get('data'),
          measured: yNode.get('measured'),
        } as Node);
      });

      const edges: Edge[] = [];
      edgesMap.forEach((yEdge) => {
        edges.push({
          id: yEdge.get('id'),
          source: yEdge.get('source'),
          target: yEdge.get('target'),
          type: yEdge.get('type'),
          data: yEdge.get('data'),
        } as Edge);
      });

      optionsRef.current.onRemoteUpdate?.(nodes, edges);
    };

    const nodesMap = doc.getMap('nodes');
    const edgesMap = doc.getMap('edges');
    nodesMap.observeDeep(onDocObserve);
    edgesMap.observeDeep(onDocObserve);

    return () => {
      destroyed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      doc.off('update', onDocUpdate);
      awareness.off('change', onAwarenessChange);
      nodesMap.unobserveDeep(onDocObserve);
      edgesMap.unobserveDeep(onDocObserve);
      // Clean awareness before closing WS so the removal propagates
      cleanupAwareness();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, doc, awareness]);

  // ─── Public API ──────────────────────────────────────────────────────────

  const syncNodes = useCallback((nodes: Node[]) => {
    isLocalUpdateRef.current = true;
    const nodesMap = doc.getMap('nodes') as Y.Map<Y.Map<any>>;

    doc.transact(() => {
      // Build set of current node IDs
      const currentIds = new Set(nodes.map(n => n.id));

      // Remove nodes that no longer exist
      const toDelete: string[] = [];
      nodesMap.forEach((_, key) => {
        if (!currentIds.has(key)) toDelete.push(key);
      });
      toDelete.forEach(key => nodesMap.delete(key));

      // Add/update nodes
      for (const node of nodes) {
        const existing = nodesMap.get(node.id);
        if (existing) {
          // Only update if changed
          const pos = existing.get('position');
          if (pos?.x !== node.position.x || pos?.y !== node.position.y) {
            existing.set('position', { x: node.position.x, y: node.position.y });
          }
          const data = existing.get('data');
          if (JSON.stringify(data) !== JSON.stringify(node.data)) {
            existing.set('data', node.data);
          }
          if (node.measured) {
            const m = existing.get('measured');
            if (m?.width !== node.measured.width || m?.height !== node.measured.height) {
              existing.set('measured', node.measured);
            }
          }
        } else {
          // New node
          const yNode = new Y.Map();
          yNode.set('id', node.id);
          yNode.set('type', node.type || 'default');
          yNode.set('position', { x: node.position.x, y: node.position.y });
          yNode.set('data', node.data || {});
          if (node.measured) yNode.set('measured', node.measured);
          nodesMap.set(node.id, yNode);
        }
      }
    }, 'local');

    isLocalUpdateRef.current = false;
  }, [doc]);

  const syncEdges = useCallback((edges: Edge[]) => {
    isLocalUpdateRef.current = true;
    const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<any>>;

    doc.transact(() => {
      const currentIds = new Set(edges.map(e => e.id));

      // Remove edges that no longer exist
      const toDelete: string[] = [];
      edgesMap.forEach((_, key) => {
        if (!currentIds.has(key)) toDelete.push(key);
      });
      toDelete.forEach(key => edgesMap.delete(key));

      // Add/update edges
      for (const edge of edges) {
        const existing = edgesMap.get(edge.id);
        if (existing) {
          const data = existing.get('data');
          if (JSON.stringify(data) !== JSON.stringify(edge.data)) {
            existing.set('data', edge.data);
          }
        } else {
          const yEdge = new Y.Map();
          yEdge.set('id', edge.id);
          yEdge.set('source', edge.source);
          yEdge.set('target', edge.target);
          yEdge.set('type', edge.type || 'default');
          yEdge.set('data', edge.data || {});
          edgesMap.set(edge.id, yEdge);
        }
      }
    }, 'local');

    isLocalUpdateRef.current = false;
  }, [doc]);

  const setCursor = useCallback((position: { x: number; y: number } | null) => {
    awareness.setLocalStateField('cursor', position);
  }, [awareness]);

  const setSelection = useCallback((nodeIds: string[], edgeIds: string[]) => {
    awareness.setLocalStateField('selectedNodeIds', nodeIds);
    awareness.setLocalStateField('selectedEdgeIds', edgeIds);
  }, [awareness]);

  const setEditingNode = useCallback((nodeId: string | null) => {
    awareness.setLocalStateField('editingNodeId', nodeId);
  }, [awareness]);

  const setEditingField = useCallback((field: { nodeId: string; fieldName: string } | null) => {
    awareness.setLocalStateField('editingField', field);
  }, [awareness]);

  const setViewport = useCallback((viewport: { x: number; y: number; zoom: number }) => {
    awareness.setLocalStateField('viewport', viewport);
  }, [awareness]);

  const setCursorMessage = useCallback((text: string | null) => {
    if (text) {
      awareness.setLocalStateField('cursorMessage', { text, timestamp: Date.now() });
    } else {
      awareness.setLocalStateField('cursorMessage', null);
    }
  }, [awareness]);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  // Compute isLeader as a stable value (only changes when connected or remoteStates change)
  const isLeader = useMemo(() => {
    if (!connected) return false;
    const allClientIds = Array.from(awareness.getStates().keys());
    return allClientIds.length === 0 || Math.min(...allClientIds) === doc.clientID;
  }, [connected, remoteStates, awareness, doc.clientID]);

  // Memoize the return object to prevent unnecessary re-renders in consumers
  return useMemo(() => ({
    connected,
    doc,
    awareness,
    syncNodes,
    syncEdges,
    setCursor,
    setSelection,
    setEditingNode,
    setEditingField,
    setViewport,
    setCursorMessage,
    remoteStates,
    isLeader,
    undo,
    redo,
    canUndo,
    canRedo,
  }), [
    connected, doc, awareness, syncNodes, syncEdges,
    setCursor, setSelection, setEditingNode, setEditingField,
    setViewport, setCursorMessage, remoteStates, isLeader,
    undo, redo, canUndo, canRedo,
  ]);
}
