/**
 * @emf-webapp/backend — MetamodelController
 *
 * REST endpoints para el CRUD de metamodelos, anidados bajo proyectos.
 *
 * GET    /api/projects/:pid/metamodels              — listar todos
 * POST   /api/projects/:pid/metamodels              — crear
 * GET    /api/projects/:pid/metamodels/:mmid        — obtener por id
 * PUT    /api/projects/:pid/metamodels/:mmid        — actualizar
 * DELETE /api/projects/:pid/metamodels/:mmid        — eliminar
 * POST   /api/projects/:pid/metamodels/:mmid/export — exportar (json | xmi)
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { MetamodelService } from './metamodel.service.js';
import { EcoreTransformer } from '../../common/ecore-transformer.js';

@Controller('projects/:pid/metamodels')
export class MetamodelController {
  constructor(
    private readonly service: MetamodelService,
    private readonly transformer: EcoreTransformer,
  ) {}

  @Get()
  findAll(@Param('pid') pid: string) {
    return this.service.findAll(pid);
  }

  @Post()
  create(
    @Param('pid') pid: string,
    @Body()
    data: {
      name: string;
      nsURI: string;
      nsPrefix: string;
      content: Record<string, any>;
    },
  ) {
    return this.service.create(pid, data);
  }

  @Get(':mmid')
  findOne(@Param('pid') pid: string, @Param('mmid') mmid: string) {
    return this.service.findOne(pid, mmid);
  }

  @Put(':mmid')
  update(
    @Param('pid') pid: string,
    @Param('mmid') mmid: string,
    @Body()
    data: {
      name?: string;
      nsURI?: string;
      nsPrefix?: string;
      content?: Record<string, any>;
    },
  ) {
    return this.service.update(pid, mmid, data);
  }

  @Delete(':mmid')
  remove(@Param('pid') pid: string, @Param('mmid') mmid: string) {
    return this.service.remove(pid, mmid);
  }

  @Post(':mmid/export')
  async exportMetamodel(
    @Param('pid') pid: string,
    @Param('mmid') mmid: string,
    @Body() data: { format: 'json' | 'xmi' },
  ) {
    const mm = await this.service.findOne(pid, mmid);
    const output = this.transformer.export(
      mm.content,
      mm.ns_uri,
      mm.ns_prefix,
      data.format,
    );
    return { format: data.format, content: output };
  }
}
