/**
 * @emf-webapp/backend — ModelVersionController
 *
 * Endpoints para historial de versiones:
 *   GET  /projects/:pid/metamodels/:mmid/versions       → lista versiones
 *   POST /projects/:pid/metamodels/:mmid/versions       → crear snapshot
 *   GET  /projects/:pid/metamodels/:mmid/versions/:vid  → obtener snapshot
 *   GET  /projects/:pid/metamodels/:mmid/versions/:vid/diff → diff con anterior
 *   POST /projects/:pid/metamodels/:mmid/versions/:vid/revert → revertir
 *   GET  /projects/:pid/metamodels/:mmid/versions/:vid/diff/:vid2 → diff específico
 *
 * Mismos endpoints para modelos M1:
 *   .../metamodels/:mmid/models/:mid/versions
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { ModelVersionService } from './modelversion.service.js';
import type { VersionSummary, VersionDiff } from './modelversion.service.js';

@Controller('projects/:pid/metamodels/:mmid')
export class ModelVersionController {
  constructor(private readonly svc: ModelVersionService) {}

  @Get('versions')
  async list(
    @Param('mmid') mmid: string,
  ): Promise<VersionSummary[]> {
    return this.svc.list('metamodel', mmid);
  }

  @Post('versions')
  async create(
    @Param('mmid') mmid: string,
    @Body() body: { snapshot: Record<string, any>; description?: string },
  ): Promise<{ id: string; versionNumber: number }> {
    const v = await this.svc.createSnapshot('metamodel', mmid, body.snapshot, body.description);
    return { id: v.id, versionNumber: v.version_number };
  }

  @Get('versions/:vid')
  async get(@Param('vid') vid: string) {
    const v = await this.svc.getById(vid);
    return { id: v.id, versionNumber: v.version_number, description: v.description, createdAt: v.createdAt, snapshot: v.snapshot };
  }

  @Get('versions/:vid/diff')
  async diff(
    @Param('mmid') mmid: string,
    @Param('vid') vid: string,
  ): Promise<VersionDiff> {
    return this.svc.diff('metamodel', mmid, vid);
  }

  @Get('versions/:vid/diff/:vid2')
  async diffBetween(
    @Param('mmid') mmid: string,
    @Param('vid') vid: string,
    @Param('vid2') vid2: string,
  ): Promise<VersionDiff> {
    return this.svc.diff('metamodel', mmid, vid, vid2);
  }

  @Post('versions/:vid/revert')
  async revertTo(@Param('vid') vid: string): Promise<{ snapshot: Record<string, any> }> {
    const snapshot = await this.svc.revertTo(vid);
    return { snapshot };
  }
}
