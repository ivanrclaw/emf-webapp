/**
 * @emf-webapp/backend — M1ModelController
 *
 * REST endpoints para modelos M1, anidados bajo proyectos y metamodelos.
 *
 * GET    /api/projects/:pid/metamodels/:mmid/models       — listar
 * POST   /api/projects/:pid/metamodels/:mmid/models       — crear
 * GET    /api/projects/:pid/metamodels/:mmid/models/:id   — obtener
 * PUT    /api/projects/:pid/metamodels/:mmid/models/:id   — actualizar
 * DELETE /api/projects/:pid/metamodels/:mmid/models/:id   — eliminar
 * GET    /api/projects/:pid/metamodels/:mmid/models/:id/export — exportar (xmi/json)
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { M1ModelService } from './m1model.service.js';
import { XmiService } from '../xmi/xmi.service.js';
import { MetamodelService } from '../metamodel/metamodel.service.js';
import type { XmiInstanceDocument } from '@emf-webapp/core/serialization';

@Controller('projects/:pid/metamodels/:mmid/models')
export class M1ModelController {
  private readonly logger = new Logger(M1ModelController.name);

  constructor(
    private readonly service: M1ModelService,
    private readonly xmiService: XmiService,
    private readonly metamodelService: MetamodelService,
  ) {}

  @Get()
  findAll(@Param('pid') pid: string, @Param('mmid') mmid: string) {
    return this.service.findAll(pid, mmid);
  }

  @Post()
  create(
    @Param('pid') pid: string,
    @Param('mmid') mmid: string,
    @Body() data: { name: string; content?: string },
  ) {
    return this.service.create(pid, mmid, data);
  }

  @Get(':id')
  findOne(
    @Param('pid') pid: string,
    @Param('mmid') mmid: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(pid, mmid, id);
  }

  @Put(':id')
  update(
    @Param('pid') pid: string,
    @Param('mmid') mmid: string,
    @Param('id') id: string,
    @Body() data: { name?: string; content?: string },
  ) {
    return this.service.update(pid, mmid, id, data);
  }

  @Delete(':id')
  remove(
    @Param('pid') pid: string,
    @Param('mmid') mmid: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(pid, mmid, id);
  }

  /**
   * GET /projects/:pid/metamodels/:mmid/models/:id/export?format=xmi
   * Exporta una instancia M1 como XMI 2.0 descargable.
   */
  @Get(':id/export')
  async exportModel(
    @Param('pid') pid: string,
    @Param('mmid') mmid: string,
    @Param('id') id: string,
    @Query('format') format: string = 'xmi',
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Fetch the M1 model
      const model = await this.service.findOne(pid, mmid, id);
      if (!model) throw new NotFoundException('Model not found');

      // Fetch the metamodel for nsURI/nsPrefix
      const metamodel = await this.metamodelService.findOne(pid, mmid);
      const content = (metamodel as any).content || {};

      // Convert M1 content (array or {objects: [...]} structure) to XmiInstanceDocument
      const raw = model.content;
      const rawInstances = Array.isArray(raw) ? raw : (raw?.objects ?? []);
      if (rawInstances.length === 0) {
        throw new BadRequestException('Model has no instances to export');
      }

      // Normalize instances to XmiInstance format (ensure children/references exist)
      const instances = rawInstances.map((obj: any) => ({
        eClass: obj.eClass,
        attributes: obj.attributes ?? {},
        references: obj.references ?? {},
        children: obj.children ?? {},
      }));

      const document: XmiInstanceDocument = {
        root: instances[0],
        nsURI: content.nsURI || '',
        nsPrefix: content.nsPrefix || 'model',
        allInstances: instances,
      };

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${model.name}.json"`);
        res.json({ document });
        return;
      }

      // Default: XMI export
      const xml = await this.xmiService.exportInstance(pid, mmid, document);
      if (!xml) {
        throw new BadRequestException('XMI export failed');
      }

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="${model.name}.xmi"`);
      res.send(xml);
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      this.logger.error(`M1 export failed for ${id}: ${err.message}`);
      throw new BadRequestException(`Export failed: ${err.message}`);
    }
  }
}
