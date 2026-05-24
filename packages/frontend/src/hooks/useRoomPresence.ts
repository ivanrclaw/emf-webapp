/**
 * @emf-webapp/frontend — useRoomPresence
 *
 * Lightweight Yjs awareness-only hook for room presence.
 * No Y.Doc sync, no UndoManager, no IndexedDB — just WebSocket + awareness.
 *
 * Connects to the same /yjs?room=<roomId> endpoint but only uses the
 * awareness protocol (MSG_AWARENESS=1) and heartbeat (MSG_HEARTBEAT=2).
 */
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PresenceState {
  user: { name: string; color: string };
  cursor: { x: number; y: number } | { line: number; column: number } | null;
  activeElementId: string | null;
  editingField: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_HEARTBEAT = 2;

const CLIENT_HEARTBEAT_INTERVAL_MS = 10_000;

const USER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ec4899',
  '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6',
];

// ─── Stable Session Identity ─────────────────────────────────────────────

function getSessionUserName(baseName: string): string {
  const key = 'emf-collab-session-name';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
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

export interface UseRoomPresenceOptions {
  roomId: string;
  userName?: string;
  userColor?: string;
}

export interface UseRoomPresenceReturn {
  connected: boolean;
  remoteStates: Map<number, PresenceState>;
  setCursor: (position: { x: number; y: number } | { line: number; column: number } | null) => void;
  setActiveElement: (elementId: string | null) => void;
  setEditingField: (field: string | null) => void;
  userName: string;
  userColor: string;
}

export function useRoomPresence(options: UseRoomPresenceOptions): UseRoomPresenceReturn {
  const { roomId } = options;

  const [connected, setConnected] = useState(false);
  const [remoteStates, setRemoteStates] = useState<Map<number, PresenceState>>(new Map());
  const remoteStatesRef = useRef<Map<number, PresenceState>>(remoteStates);

  // Resolve stable identity once (memoized across renders)
  const userName = useMemo(
    () => getSessionUserName(options.userName || 'Anonymous'),
    [options.userName]
  );
  const userColor = useMemo(
    () => options.userColor || getSessionColor(),
    [options.userColor]
  );

  // Y.Doc is needed only as an awareness host (provides clientID)
  const docRef = useRef<Y.Doc>(new Y.Doc());
  const awarenessRef = useRef<awarenessProtocol.Awareness>(
    new awarenessProtocol.Awareness(docRef.current)
  );
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanedUpRef = useRef(false);

  const doc = docRef.current;
  const awareness = awarenessRef.current;

  // WebSocket connection
  useEffect(() => {
    if (!roomId) return;

    let destroyed = false;
    cleanedUpRef.current = false;

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
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        cleanedUpRef.current = false;
        setConnected(true);

        // Set awareness state — awareness-only, no sync step needed
        awareness.setLocalState({
          user: { name: userName, color: userColor },
          cursor: null,
          activeElementId: null,
          editingField: null,
        } satisfies PresenceState);

        // Start heartbeat
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => sendHeartbeat(ws), CLIENT_HEARTBEAT_INTERVAL_MS);
        sendHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data as ArrayBuffer);
        const decoder = decoding.createDecoder(data);
        const msgType = decoding.readVarUint(decoder);

        switch (msgType) {
          case MSG_SYNC:
            // Ignore sync messages — we don't participate in doc sync
            break;
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
        setConnected(false);
        wsRef.current = null;

        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        // Reconnect after delay
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    // Listen for awareness changes → send to server
    const onAwarenessChange = ({ added, updated, removed }: any) => {
      const changedClients = [...added, ...updated, ...removed];
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

      // Update remote states for React
      const states = new Map<number, PresenceState>();
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== doc.clientID && state.user) {
          states.set(clientId, state as PresenceState);
        }
      });

      // Shallow compare to avoid unnecessary re-renders
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
    };
    awareness.on('change', onAwarenessChange);

    // Clean up awareness on page unload
    const onBeforeUnload = () => {
      cleanupAwareness();
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

    // Visibility change — send heartbeat when tab becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendHeartbeat(ws);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      destroyed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      awareness.off('change', onAwarenessChange);
      cleanupAwareness();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, doc, awareness, userName, userColor]);

  // ─── Public API ──────────────────────────────────────────────────────────

  const setCursor = useCallback((position: { x: number; y: number } | { line: number; column: number } | null) => {
    awareness.setLocalStateField('cursor', position);
  }, [awareness]);

  const setActiveElement = useCallback((elementId: string | null) => {
    awareness.setLocalStateField('activeElementId', elementId);
  }, [awareness]);

  const setEditingField = useCallback((field: string | null) => {
    awareness.setLocalStateField('editingField', field);
  }, [awareness]);

  return {
    connected,
    remoteStates,
    setCursor,
    setActiveElement,
    setEditingField,
    userName,
    userColor,
  };
}
