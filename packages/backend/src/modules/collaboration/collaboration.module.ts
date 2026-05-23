/**
 * @emf-webapp/backend — Collaboration Module
 *
 * Provides both the legacy Socket.IO gateway (for backward compat)
 * and the new Yjs CRDT-based collaboration service.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationGateway } from './collaboration.gateway.js';
import { YjsCollaborationService } from './yjs-collaboration.service.js';
import { CollaborationSnapshot } from './entities/collaboration-snapshot.entity.js';
import { CollaborationUpdate } from './entities/collaboration-update.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollaborationSnapshot, CollaborationUpdate]),
  ],
  providers: [CollaborationGateway, YjsCollaborationService],
  exports: [CollaborationGateway, YjsCollaborationService],
})
export class CollaborationModule {}
