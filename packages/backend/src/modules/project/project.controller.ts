/**
 * @emf-webapp/backend — ProjectController
 *
 * REST endpoints para el CRUD de proyectos.
 *
 * GET    /api/projects          — listar todos (paginado)
 * GET    /api/projects/:id      — obtener por id
 * POST   /api/projects          — crear
 * PUT    /api/projects/:id      — actualizar
 * DELETE /api/projects/:id      — eliminar
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
} from '@nestjs/common';
import { Response } from 'express';
import { ProjectService } from './project.service.js';
import { ProjectExportService } from './project-export.service.js';

@Controller('projects')
export class ProjectController {
  constructor(
    private readonly service: ProjectService,
    private readonly exportService: ProjectExportService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() data: { name: string; description?: string }) {
    return this.service.create(data);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string },
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/export/zip')
  async exportZip(@Param('id') id: string, @Res() res: Response): Promise<void> {
    try {
      const buffer = await this.exportService.exportProjectAsZip(id);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="project-${id}.zip"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: 'Failed to export project as ZIP', details: (err as Error).message });
    }
  }

  @Get(':id/export/eclipse')
  async exportEclipse(@Param('id') id: string, @Res() res: Response): Promise<void> {
    try {
      const buffer = await this.exportService.exportProjectAsEclipse(id);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="project-${id}-eclipse.zip"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: 'Failed to export project as Eclipse bundle', details: (err as Error).message });
    }
  }
}
