/**
 * @emf-webapp/backend — Collaboration Module
 */
import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway.js';

@Module({
  providers: [CollaborationGateway],
  exports: [CollaborationGateway],
})
export class CollaborationModule {}
