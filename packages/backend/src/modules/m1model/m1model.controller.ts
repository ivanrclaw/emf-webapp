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
import { M1ModelService } from './m1model.service.js';

@Controller('projects/:pid/metamodels/:mmid/models')
export class M1ModelController {
  constructor(private readonly service: M1ModelService) {}

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
}
