/**
 * @emf-webapp/backend — Collaboration Gateway
 *
 * WebSocket gateway para edición colaborativa en tiempo real.
 *
 * EVENTOS:
 * ──────────────────────────────────────────────
 * Cliente → Servidor:
 *   join-room        { metamodelId, userName }
 *   leave-room       { metamodelId }
 *   model-changed    { metamodelId, content }      — cambio completo
 *   cursor-move      { metamodelId, position }      — cursor en canvas
 *   user-typing      { metamodelId }
 *
 * Servidor → Cliente:
 *   room-users       { users: [{ id, name, cursor }] }
 *   user-joined      { id, name }
 *   user-left        { id, name }
 *   model-synced     { content }                    — estado completo
 *   model-update     { content, by: userName }      — cambio de otro
 *   cursor-update    { userId, userName, position }
 *   user-typing      { userName }
 * ──────────────────────────────────────────────
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// ─── Tipos ────────────────────────────────────────────────────────────────

interface RoomUser {
  socketId: string;
  userId: string;
  userName: string;
  cursor: { x: number; y: number } | null;
}

interface RoomState {
  users: Map<string, RoomUser>;
  currentContent: Record<string, any> | null;
}

// ─── Gateway ──────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: { origin: '*', methods: ['GET', 'POST'] },
  namespace: '/collaboration',
})
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  /** rooms: metamodelId → { users, currentContent } */
  private rooms = new Map<string, RoomState>();

  // ── Lifecycle ───────────────────────────────────────────────────────────

  handleConnection(client: Socket): void {
    console.log(`[WS] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    console.log(`[WS] Client disconnected: ${client.id}`);
    // Remove from all rooms
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.has(client.id)) {
        const user = room.users.get(client.id)!;
        room.users.delete(client.id);
        client.leave(roomId);

        // Notify remaining users
        this.server.to(roomId).emit('user-left', {
          id: client.id,
          userName: user.userName,
        });
        this.broadcastRoomUsers(roomId);

        if (room.users.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }
  }

  // ── Eventos ─────────────────────────────────────────────────────────────

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { metamodelId: string; userName: string },
  ): void {
    const { metamodelId, userName } = data;
    if (!metamodelId || !userName) return;

    // Obtener o crear sala
    if (!this.rooms.has(metamodelId)) {
      this.rooms.set(metamodelId, {
        users: new Map(),
        currentContent: null,
      });
    }
    const room = this.rooms.get(metamodelId)!;

    // Generar userId persistente para esta sesión
    const userId = `${client.id}_${metamodelId}`;

    // Si ya está en la sala, actualizar
    if (room.users.has(client.id)) {
      room.users.get(client.id)!.userName = userName;
      this.broadcastRoomUsers(metamodelId);
      return;
    }

    const user: RoomUser = {
      socketId: client.id,
      userId,
      userName,
      cursor: null,
    };

    room.users.set(client.id, user);
    client.join(metamodelId);

    // Notificar a los demás
    client.to(metamodelId).emit('user-joined', { id: client.id, userName });

    // Enviar lista actualizada a todos
    this.broadcastRoomUsers(metamodelId);

    // Enviar estado actual del modelo al que se acaba de conectar
    if (room.currentContent) {
      client.emit('model-synced', { content: room.currentContent });
    }
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { metamodelId: string },
  ): void {
    const { metamodelId } = data;
    this.removeUserFromRoom(client, metamodelId);
  }

  @SubscribeMessage('model-changed')
  handleModelChanged(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { metamodelId: string; content: Record<string, any> },
  ): void {
    const { metamodelId, content } = data;
    const room = this.rooms.get(metamodelId);
    if (!room) return;

    const user = room.users.get(client.id);
    room.currentContent = content;

    // Broadcast a TODOS en la sala excepto el emisor
    client.to(metamodelId).emit('model-update', {
      content,
      by: user?.userName ?? 'unknown',
    });
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { metamodelId: string; position: { x: number; y: number } },
  ): void {
    const { metamodelId, position } = data;
    const room = this.rooms.get(metamodelId);
    if (!room) return;

    const user = room.users.get(client.id);
    if (user) {
      user.cursor = position;
    }

    client.to(metamodelId).emit('cursor-update', {
      userId: client.id,
      userName: user?.userName ?? 'unknown',
      position,
    });
  }

  @SubscribeMessage('user-typing')
  handleUserTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { metamodelId: string },
  ): void {
    const { metamodelId } = data;
    const room = this.rooms.get(metamodelId);
    if (!room) return;

    const user = room.users.get(client.id);
    if (user) {
      client.to(metamodelId).emit('user-typing', {
        userName: user.userName,
      });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private removeUserFromRoom(client: Socket, metamodelId: string): void {
    const room = this.rooms.get(metamodelId);
    if (!room) return;

    const user = room.users.get(client.id);
    if (user) {
      room.users.delete(client.id);
      client.leave(metamodelId);

      this.server.to(metamodelId).emit('user-left', {
        id: client.id,
        userName: user.userName,
      });
      this.broadcastRoomUsers(metamodelId);

      if (room.users.size === 0) {
        this.rooms.delete(metamodelId);
      }
    }
  }

  private broadcastRoomUsers(metamodelId: string): void {
    const room = this.rooms.get(metamodelId);
    if (!room) return;

    const users = Array.from(room.users.values()).map(u => ({
      id: u.socketId,
      userId: u.userId,
      userName: u.userName,
      cursor: u.cursor,
    }));

    this.server.to(metamodelId).emit('room-users', { users });
  }
}
