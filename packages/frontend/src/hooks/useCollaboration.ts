/**
 * @emf-webapp/frontend — useCollaboration
 *
 * Hook de React para conectar al WebSocket de colaboración en tiempo real.
 *
 * Uso:
 *   const collab = useCollaboration(metamodelId, 'Iván');
 *   collab.sendModelUpdate(content);
 *   collab.sendCursorMove({ x, y });
 *   collab.sendUserTyping();
 *
 * Eventos recibidos (via onModelUpdate, onRoomUsers, etc.):
 *   - onModelUpdate(content, by)
 *   - onRoomUsers(users: [{ id, userName, cursor }])
 *   - onUserJoined(id, userName)
 *   - onUserLeft(id, userName)
 *   - onCursorUpdate(userId, userName, position)
 *   - onUserTyping(userName)
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Tipos ───────────────────────────────────────────────────────────────

export interface RoomUser {
  id: string;
  userName: string;
  cursor: { x: number; y: number } | null;
}

export interface UseCollaborationOptions {
  /** Nombre visible del usuario */
  userName?: string;
  /** Callback cuando otro usuario envía un cambio de modelo */
  onModelUpdate?: (content: Record<string, any>, by: string) => void;
  /** Callback cuando se recibe el estado completo inicial */
  onModelSynced?: (content: Record<string, any>) => void;
  /** Callback con la lista actual de usuarios en la sala */
  onRoomUsers?: (users: RoomUser[]) => void;
  /** Callback cuando alguien se une */
  onUserJoined?: (id: string, userName: string) => void;
  /** Callback cuando alguien se va */
  onUserLeft?: (id: string, userName: string) => void;
  /** Callback cuando alguien mueve el cursor */
  onCursorUpdate?: (userId: string, userName: string, position: { x: number; y: number }) => void;
  /** Callback cuando alguien está escribiendo */
  onUserTyping?: (userName: string) => void;
  /** Callback de estado de conexión */
  onConnectionChange?: (connected: boolean) => void;
}

export interface UseCollaborationReturn {
  /** ¿Está conectado al WS? */
  connected: boolean;
  /** Usuarios en la sala (incluyéndote) */
  roomUsers: RoomUser[];
  /** Enviar cambio completo del modelo a los demás */
  sendModelUpdate: (content: Record<string, any>) => void;
  /** Enviar posición del cursor */
  sendCursorMove: (position: { x: number; y: number }) => void;
  /** Notificar que estás editando */
  sendUserTyping: () => void;
  /** Desconectarse manualmente */
  disconnect: () => void;
}

// ─── Conexión global (single socket) ─────────────────────────────────────

let globalSocket: Socket | null = null;
let globalRefCount = 0;

function getSocket(): Socket {
  if (!globalSocket) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    globalSocket = io(`${protocol}//${host}/collaboration`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return globalSocket;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useCollaboration(
  metamodelId: string | undefined,
  options?: UseCollaborationOptions
): UseCollaborationReturn {
  const [connected, setConnected] = useState(false);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Incrementar ref count al montar
  useEffect(() => {
    globalRefCount++;
    return () => {
      globalRefCount--;
      if (globalRefCount <= 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!metamodelId) return;

    const socket = getSocket();

    function onConnect() {
      setConnected(true);
      optionsRef.current?.onConnectionChange?.(true);

      // Unirse a la sala
      const userName = optionsRef.current?.userName || 'Anonymous';
      socket.emit('join-room', { metamodelId, userName });
    }

    function onDisconnect() {
      setConnected(false);
      optionsRef.current?.onConnectionChange?.(false);
    }

    function onRoomUsers(data: { users: RoomUser[] }) {
      setRoomUsers(data.users);
      optionsRef.current?.onRoomUsers?.(data.users);
    }

    function onUserJoined(data: { id: string; userName: string }) {
      optionsRef.current?.onUserJoined?.(data.id, data.userName);
    }

    function onUserLeft(data: { id: string; userName: string }) {
      optionsRef.current?.onUserLeft?.(data.id, data.userName);
    }

    function onModelUpdate(data: { content: Record<string, any>; by: string }) {
      optionsRef.current?.onModelUpdate?.(data.content, data.by);
    }

    function onModelSynced(data: { content: Record<string, any> }) {
      optionsRef.current?.onModelSynced?.(data.content);
    }

    function onCursorUpdate(data: { userId: string; userName: string; position: { x: number; y: number } }) {
      optionsRef.current?.onCursorUpdate?.(data.userId, data.userName, data.position);
    }

    function onUserTyping(data: { userName: string }) {
      optionsRef.current?.onUserTyping?.(data.userName);
    }

    // Registrar listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-users', onRoomUsers);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('model-update', onModelUpdate);
    socket.on('model-synced', onModelSynced);
    socket.on('cursor-update', onCursorUpdate);
    socket.on('user-typing', onUserTyping);

    // Si ya está conectado, disparar join inmediatamente
    if (socket.connected) {
      onConnect();
    }

    return () => {
      // Salir de la sala
      if (socket.connected && metamodelId) {
        socket.emit('leave-room', { metamodelId });
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-users', onRoomUsers);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('model-update', onModelUpdate);
      socket.off('model-synced', onModelSynced);
      socket.off('cursor-update', onCursorUpdate);
      socket.off('user-typing', onUserTyping);
      setConnected(false);
    };
  }, [metamodelId]);

  const sendModelUpdate = useCallback((content: Record<string, any>) => {
    if (globalSocket?.connected && metamodelId) {
      globalSocket.emit('model-changed', { metamodelId, content });
    }
  }, [metamodelId]);

  const sendCursorMove = useCallback((position: { x: number; y: number }) => {
    if (globalSocket?.connected && metamodelId) {
      globalSocket.emit('cursor-move', { metamodelId, position });
    }
  }, [metamodelId]);

  const sendUserTyping = useCallback(() => {
    if (globalSocket?.connected && metamodelId) {
      globalSocket.emit('user-typing', { metamodelId });
    }
  }, [metamodelId]);

  const disconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
    }
    globalRefCount = 0;
    setConnected(false);
  }, []);

  return {
    connected,
    roomUsers,
    sendModelUpdate,
    sendCursorMove,
    sendUserTyping,
    disconnect,
  };
}
