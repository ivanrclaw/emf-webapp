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
 * - Production-grade presence management:
 *   • Heartbeat protocol (MSG_HEARTBEAT = 2)
 *   • TTL sweep every 10s — removes stale awareness states (>30s without heartbeat)
 *   • Aggressive cleanup on WS close — immediate removal of all tracked clientIDs
 *   • Broadcast of awareness removals to remaining clients
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
const MSG_HEARTBEAT = 2;

// Heartbeat / TTL configuration
const HEARTBEAT_INTERVAL_MS = 15_000; // Server sends heartbeat ping every 15s
const HEARTBEAT_TTL_MS = 30_000; // Client considered stale after 30s without heartbeat
const SWEEP_INTERVAL_MS = 10_000; // Sweep for stale clients every 10s

// Compaction threshold: merge updates into snapshot after this many
const COMPACTION_THRESHOLD = 50;
// Room cleanup: remove from memory after 30min of inactivity
const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface YjsRoom {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  /** Map WebSocket → awareness clientID (learned from first awareness message) */
  clientIds: Map<WebSocket, number>;
  /** Tracks last heartbeat timestamp per clientID for TTL sweep */
  clientLastSeen: Map<number, number>;
  lastActivity: number;
  updateCount: number;
  persistTimer: ReturnType<typeof setTimeout> | null;
  /** Batched updates waiting to be persisted */
  pendingUpdates: Uint8Array[];
  /** Timer for batched persistence flush */
  batchTimer: ReturnType<typeof setTimeout> | null;
}

/** Per-WebSocket metadata for heartbeat intervals */
interface ClientMeta {
  heartbeatInterval: ReturnType<typeof setInterval>;
}

@Injectable()
export class YjsCollaborationService implements OnModuleInit, OnModuleDestroy {
  private rooms = new Map<string, YjsRoom>();
  private wss: WebSocketServer | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private sweepInterval: ReturnType<typeof setInterval> | null = null;
  /** Per-WebSocket metadata (heartbeat timers) — keyed by ws instance */
  private clientMeta = new WeakMap<WebSocket, ClientMeta>();

  constructor(
    @InjectRepository(CollaborationSnapshot)
    private snapshotRepo: Repository<CollaborationSnapshot>,
    @InjectRepository(CollaborationUpdate)
    private updateRepo: Repository<CollaborationUpdate>,
  ) {}

  onModuleInit() {
    // Cleanup idle rooms every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupIdleRooms(), 5 * 60 * 1000);
    // Sweep stale awareness states every 10 seconds
    this.sweepInterval = setInterval(() => this.sweepStaleClients(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.sweepInterval) clearInterval(this.sweepInterval);
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
    console.log(`[Yjs] Client connected to room ${roomId}, total clients: ${room.clients.size}`);

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

    // Start heartbeat ping interval for this client
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const hbEncoder = encoding.createEncoder();
        encoding.writeVarUint(hbEncoder, MSG_HEARTBEAT);
        ws.send(encoding.toUint8Array(hbEncoder));
      }
    }, HEARTBEAT_INTERVAL_MS);

    this.clientMeta.set(ws, { heartbeatInterval });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        this.handleMessage(ws, room, roomId, new Uint8Array(data));
      } catch (err) {
        console.error(`[Yjs] Error handling message in room ${roomId}:`, err);
      }
    });

    ws.on('close', () => {
      this.cleanupClient(ws, room, roomId);
    });

    ws.on('error', (err) => {
      console.error(`[Yjs] WebSocket error in room ${roomId}:`, err);
      this.cleanupClient(ws, room, roomId);
    });
  }

  /**
   * Aggressively clean up all state associated with a disconnected WebSocket.
   * Removes awareness states, clears heartbeat tracking, and broadcasts removal.
   */
  private cleanupClient(ws: WebSocket, room: YjsRoom, roomId: string): void {
    // Prevent double-cleanup
    if (!room.clients.has(ws)) return;
    room.clients.delete(ws);

    // Clear heartbeat interval for this client
    const meta = this.clientMeta.get(ws);
    if (meta) {
      clearInterval(meta.heartbeatInterval);
      this.clientMeta.delete(ws);
    }

    // Remove awareness state and broadcast removal
    const clientId = room.clientIds.get(ws);
    if (clientId !== undefined) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [clientId],
        null,
      );
      // Broadcast the removal to all remaining clients
      this.broadcastAwarenessRemoval(room, [clientId]);
      // Clean up tracking maps
      room.clientIds.delete(ws);
      room.clientLastSeen.delete(clientId);
    }

    room.lastActivity = Date.now();

    // If no clients left, schedule persistence
    if (room.clients.size === 0) {
      this.schedulePersist(roomId, room);
    }
  }

  private handleMessage(ws: WebSocket, room: YjsRoom, roomId: string, data: Uint8Array): void {
    const decoder = decoding.createDecoder(data);
    const msgType = decoding.readVarUint(decoder);

    room.lastActivity = Date.now();
    console.log(`[Yjs] Received msg type=${msgType} (${msgType === 0 ? 'SYNC' : msgType === 1 ? 'AWARENESS' : 'HEARTBEAT'}) in room ${roomId}, data.length=${data.length}`);

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

        // Track the clientID for this WebSocket (extracted from awareness update)
        // Awareness updates encode: [length, clientID, clock, state...]
        // We can learn the sender's clientID from the update
        if (!room.clientIds.has(ws)) {
          try {
            const updateDecoder = decoding.createDecoder(update);
            const len = decoding.readVarUint(updateDecoder);
            if (len > 0) {
              const clientId = decoding.readVarUint(updateDecoder);
              room.clientIds.set(ws, clientId);
              // Initialize lastSeen for this clientID
              room.clientLastSeen.set(clientId, Date.now());
            }
          } catch {
            // Ignore parse errors — we'll get it on the next message
          }
        } else {
          // Update lastSeen on any awareness message (acts as implicit heartbeat)
          const clientId = room.clientIds.get(ws);
          if (clientId !== undefined) {
            room.clientLastSeen.set(clientId, Date.now());
          }
        }

        // Broadcast awareness to all OTHER clients
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(encoder, update);
        const msg = encoding.toUint8Array(encoder);
        let sentCount = 0;
        room.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msg);
            sentCount++;
          }
        });
        if (sentCount > 0) {
          console.log(`[Yjs] Broadcast awareness to ${sentCount} other client(s) in room ${roomId}`);
        }
        break;
      }

      case MSG_HEARTBEAT: {
        // Client responded to heartbeat ping — update lastSeen
        const clientId = room.clientIds.get(ws);
        if (clientId !== undefined) {
          room.clientLastSeen.set(clientId, Date.now());
        }
        break;
      }
    }
  }

  // ─── Heartbeat / TTL Sweep ──────────────────────────────────────────────────

  /**
   * Sweep all rooms for stale awareness states.
   * Any clientID whose lastSeen is older than HEARTBEAT_TTL_MS gets removed
   * and the removal is broadcast to all remaining clients in the room.
   */
  private sweepStaleClients(): void {
    const now = Date.now();

    for (const [, room] of this.rooms) {
      if (room.clientLastSeen.size === 0) continue;

      const staleClientIds: number[] = [];

      for (const [clientId, lastSeen] of room.clientLastSeen) {
        if (now - lastSeen > HEARTBEAT_TTL_MS) {
          staleClientIds.push(clientId);
        }
      }

      if (staleClientIds.length === 0) continue;

      // Remove stale awareness states from the server's awareness instance
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        staleClientIds,
        null,
      );

      // Broadcast the removal to all remaining clients
      this.broadcastAwarenessRemoval(room, staleClientIds);

      // Clean up tracking maps
      for (const clientId of staleClientIds) {
        room.clientLastSeen.delete(clientId);
        // Also remove from clientIds map (find the ws that had this clientId)
        for (const [ws, id] of room.clientIds) {
          if (id === clientId) {
            room.clientIds.delete(ws);
            // Clear heartbeat interval for this stale client's ws
            const meta = this.clientMeta.get(ws);
            if (meta) {
              clearInterval(meta.heartbeatInterval);
              this.clientMeta.delete(ws);
            }
            // Remove from clients set (the ws is likely already dead)
            room.clients.delete(ws);
            break;
          }
        }
      }

      console.log(
        `[Yjs] Swept ${staleClientIds.length} stale client(s): [${staleClientIds.join(', ')}]`,
      );
    }
  }

  /**
   * Broadcast an awareness removal message to all connected clients in a room.
   * Encodes the removed clientIDs with null state so clients clear their UI.
   */
  private broadcastAwarenessRemoval(room: YjsRoom, clientIds: number[]): void {
    if (room.clients.size === 0 || clientIds.length === 0) return;

    // Encode an awareness update with null states for the removed clients.
    // The awareness protocol encodes removals as: clientID with clock incremented and null state.
    // We use encodeAwarenessUpdate which reads from the awareness instance —
    // but since we already called removeAwarenessStates, those clients now have null state.
    // We need to manually encode the removal message.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, clientIds.length);
    for (const clientId of clientIds) {
      encoding.writeVarUint(encoder, clientId);
      // Clock = 1 (any value > 0 signals an update; clients will see null state)
      encoding.writeVarUint(encoder, 1);
      // Null state encoded as JSON "null"
      encoding.writeVarString(encoder, 'null');
    }
    const removalUpdate = encoding.toUint8Array(encoder);

    const msgEncoder = encoding.createEncoder();
    encoding.writeVarUint(msgEncoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(msgEncoder, removalUpdate);
    const msg = encoding.toUint8Array(msgEncoder);

    room.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  // ─── Room Management ────────────────────────────────────────────────────────

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

        // Track updates for compaction (batched persistence)
        room.updateCount++;
        room.pendingUpdates.push(update);
        this.scheduleBatchFlush(roomId, room);

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
      clientIds: new Map(),
      clientLastSeen: new Map(),
      lastActivity: Date.now(),
      updateCount: 0,
      persistTimer: null,
      pendingUpdates: [],
      batchTimer: null,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  /**
   * Batch rapid updates into a single DB write (every 100ms).
   * Reduces SQLite write pressure during drag operations.
   */
  private scheduleBatchFlush(roomId: string, room: YjsRoom): void {
    if (room.batchTimer) return; // Already scheduled
    room.batchTimer = setTimeout(async () => {
      room.batchTimer = null;
      const updates = room.pendingUpdates.splice(0);
      if (updates.length === 0) return;

      // Merge all pending updates into one
      const merged = Y.mergeUpdates(updates);
      await this.saveUpdate(roomId, merged).catch(console.error);
    }, 100); // 100ms batch window
  }

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
