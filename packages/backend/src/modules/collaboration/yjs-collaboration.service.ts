/**
 * @emf-webapp/backend — Yjs WebSocket Server
 *
 * Handles Yjs document synchronization over WebSocket.
 * Each metamodel gets its own Y.Doc instance.
 *
 * Features:
 * - Sync protocol (y-protocols/sync)
 * - Awareness protocol (y-protocols/awareness)
 * - SQLite persistence (snapshots + incremental updates)
 * - Automatic compaction of update log
 * - Room cleanup on inactivity
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { WebSocketServer, WebSocket } from 'ws';
import { CollaborationSnapshot } from './entities/collaboration-snapshot.entity.js';
import { CollaborationUpdate } from './entities/collaboration-update.entity.js';

// Message types matching y-websocket protocol
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// Compaction threshold: merge updates into snapshot after this many
const COMPACTION_THRESHOLD = 50;
// Room cleanup: remove from memory after 30min of inactivity
const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface YjsRoom {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  lastActivity: number;
  updateCount: number;
  persistTimer: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class YjsCollaborationService implements OnModuleInit, OnModuleDestroy {
  private rooms = new Map<string, YjsRoom>();
  private wss: WebSocketServer | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(CollaborationSnapshot)
    private snapshotRepo: Repository<CollaborationSnapshot>,
    @InjectRepository(CollaborationUpdate)
    private updateRepo: Repository<CollaborationUpdate>,
  ) {}

  onModuleInit() {
    // Cleanup idle rooms every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupIdleRooms(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    // Persist all rooms before shutdown
    for (const [roomId, room] of this.rooms) {
      this.persistRoom(roomId, room).catch(console.error);
    }
    if (this.wss) this.wss.close();
  }

  /**
   * Attach the Yjs WebSocket handler to an existing HTTP server.
   * Called from the NestJS bootstrap after the app starts listening.
   */
  attachToServer(server: any): void {
    this.wss = new WebSocketServer({ server, path: '/yjs' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const roomId = url.searchParams.get('room');
      if (!roomId) {
        ws.close(4001, 'Missing room parameter');
        return;
      }

      this.handleConnection(ws, roomId);
    });

    console.log('[Yjs] WebSocket server attached at /yjs');
  }

  private async handleConnection(ws: WebSocket, roomId: string): Promise<void> {
    const room = await this.getOrCreateRoom(roomId);
    room.clients.add(ws);
    room.lastActivity = Date.now();

    // Send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send current awareness states
    const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
      room.awareness,
      Array.from(room.awareness.getStates().keys()),
    );
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(awarenessEncoder, awarenessStates);
    ws.send(encoding.toUint8Array(awarenessEncoder));

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        this.handleMessage(ws, room, roomId, new Uint8Array(data));
      } catch (err) {
        console.error(`[Yjs] Error handling message in room ${roomId}:`, err);
      }
    });

    ws.on('close', () => {
      room.clients.delete(ws);
      // Remove awareness state for this client
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [room.doc.clientID], // This is approximate; proper impl tracks per-ws clientID
        null,
      );
      room.lastActivity = Date.now();

      // If no clients left, schedule persistence
      if (room.clients.size === 0) {
        this.schedulePersist(roomId, room);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Yjs] WebSocket error in room ${roomId}:`, err);
      room.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, room: YjsRoom, roomId: string, data: Uint8Array): void {
    const decoder = decoding.createDecoder(data);
    const msgType = decoding.readVarUint(decoder);

    room.lastActivity = Date.now();

    switch (msgType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, null);

        // If encoder has content (sync step 2 response), send back
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
        break;
      }

      case MSG_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
        // Broadcast awareness to all OTHER clients
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(encoder, update);
        const msg = encoding.toUint8Array(encoder);
        room.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        });
        break;
      }
    }
  }

  private async getOrCreateRoom(roomId: string): Promise<YjsRoom> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    // Load persisted state
    await this.loadPersistedState(roomId, doc);

    // Listen for document updates to broadcast and persist
    doc.on('update', (update: Uint8Array, origin: any) => {
      // Broadcast to all clients except the origin
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const msg = encoding.toUint8Array(encoder);

      const room = this.rooms.get(roomId);
      if (room) {
        room.clients.forEach((client) => {
          if (client !== origin && client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        });

        // Track updates for compaction
        room.updateCount++;
        this.saveUpdate(roomId, update).catch(console.error);

        // Compact if threshold reached
        if (room.updateCount >= COMPACTION_THRESHOLD) {
          this.compactRoom(roomId, room).catch(console.error);
          room.updateCount = 0;
        }
      }
    });

    const room: YjsRoom = {
      doc,
      awareness,
      clients: new Set(),
      lastActivity: Date.now(),
      updateCount: 0,
      persistTimer: null,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private async loadPersistedState(roomId: string, doc: Y.Doc): Promise<void> {
    try {
      // Load snapshot
      const snapshot = await this.snapshotRepo.findOne({ where: { roomId } });
      if (snapshot) {
        Y.applyUpdate(doc, snapshot.state);
      }

      // Apply incremental updates since snapshot
      const updates = await this.updateRepo.find({
        where: { roomId },
        order: { createdAt: 'ASC' },
      });
      for (const update of updates) {
        Y.applyUpdate(doc, update.data);
      }

      if (snapshot || updates.length > 0) {
        console.log(`[Yjs] Loaded room ${roomId}: snapshot=${!!snapshot}, updates=${updates.length}`);
      }
    } catch (err) {
      console.error(`[Yjs] Error loading persisted state for room ${roomId}:`, err);
    }
  }

  private async saveUpdate(roomId: string, update: Uint8Array): Promise<void> {
    const entity = this.updateRepo.create({
      roomId,
      data: Buffer.from(update),
    });
    await this.updateRepo.save(entity);
  }

  private async compactRoom(roomId: string, room: YjsRoom): Promise<void> {
    try {
      const state = Y.encodeStateAsUpdate(room.doc);

      // Save new snapshot
      let snapshot = await this.snapshotRepo.findOne({ where: { roomId } });
      if (snapshot) {
        snapshot.state = Buffer.from(state);
        snapshot.updatedAt = new Date();
      } else {
        snapshot = this.snapshotRepo.create({
          roomId,
          state: Buffer.from(state),
        });
      }
      await this.snapshotRepo.save(snapshot);

      // Clear incremental updates
      await this.updateRepo.delete({ roomId });

      console.log(`[Yjs] Compacted room ${roomId} (${state.length} bytes)`);
    } catch (err) {
      console.error(`[Yjs] Error compacting room ${roomId}:`, err);
    }
  }

  private async persistRoom(roomId: string, room: YjsRoom): Promise<void> {
    await this.compactRoom(roomId, room);
  }

  private schedulePersist(roomId: string, room: YjsRoom): void {
    if (room.persistTimer) clearTimeout(room.persistTimer);
    room.persistTimer = setTimeout(() => {
      this.persistRoom(roomId, room).catch(console.error);
    }, 5000); // Persist 5s after last client leaves
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  private cleanupIdleRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      if (room.clients.size === 0 && now - room.lastActivity > ROOM_IDLE_TIMEOUT_MS) {
        this.persistRoom(roomId, room).then(() => {
          room.doc.destroy();
          this.rooms.delete(roomId);
          console.log(`[Yjs] Cleaned up idle room ${roomId}`);
        }).catch(console.error);
      }
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Get the current Y.Doc for a room (for server-side operations like export).
   */
  async getDocForRoom(roomId: string): Promise<Y.Doc> {
    const room = await this.getOrCreateRoom(roomId);
    return room.doc;
  }

  /**
   * Get room stats for monitoring.
   */
  getRoomStats(): Array<{ roomId: string; clients: number; lastActivity: number }> {
    return Array.from(this.rooms.entries()).map(([roomId, room]) => ({
      roomId,
      clients: room.clients.size,
      lastActivity: room.lastActivity,
    }));
  }
}
