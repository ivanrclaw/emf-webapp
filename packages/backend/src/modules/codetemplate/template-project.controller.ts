/**
 * @emf-webapp/backend — TemplateProjectController
 *
 * REST endpoints for multi-file template projects, nested under metamodels.
 *
 * GET    /api/metamodels/:mmid/template-projects              — list projects
 * POST   /api/metamodels/:mmid/template-projects              — create project
 * GET    /api/metamodels/:mmid/template-projects/:id          — get project with files
 * PUT    /api/metamodels/:mmid/template-projects/:id          — update project
 * DELETE /api/metamodels/:mmid/template-projects/:id          — delete project
 * POST   /api/metamodels/:mmid/template-projects/:id/files    — add file
 * PUT    /api/metamodels/:mmid/template-projects/:id/files/:fid — update file
 * DELETE /api/metamodels/:mmid/template-projects/:id/files/:fid — remove file
 * PUT    /api/metamodels/:mmid/template-projects/:id/files/reorder — reorder files
 * POST   /api/metamodels/:mmid/template-projects/:id/generate — generate from project
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
import { TemplateProjectService } from './template-project.service.js';
import type { TemplateLanguage } from './codetemplate.entity.js';

@Controller('metamodels/:mmid/template-projects')
export class TemplateProjectController {
  constructor(private readonly service: TemplateProjectService) {}

  @Get()
  findAll(@Param('mmid') mmid: string) {
    return this.service.findAll(mmid);
  }

  @Post()
  create(
    @Param('mmid') mmid: string,
    @Body() data: { name: string; description?: string; metamodelUri?: string; rootType?: string },
  ) {
    return this.service.create(mmid, data);
  }

  @Get(':id')
  findOne(@Param('mmid') mmid: string, @Param('id') id: string) {
    return this.service.findOne(mmid, id);
  }

  @Put(':id')
  update(
    @Param('mmid') mmid: string,
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string },
  ) {
    return this.service.update(mmid, id, data);
  }

  @Delete(':id')
  remove(@Param('mmid') mmid: string, @Param('id') id: string) {
    return this.service.remove(mmid, id);
  }

  @Post(':id/files')
  addFile(
    @Param('mmid') mmid: string,
    @Param('id') id: string,
    @Body() data: { filename: string; template: string; language?: TemplateLanguage },
  ) {
    return this.service.addFile(mmid, id, data);
  }

  @Put(':id/files/reorder')
  reorderFiles(
    @Param('mmid') mmid: string,
    @Param('id') id: string,
    @Body() data: { fileIds: string[] },
  ) {
    return this.service.reorderFiles(mmid, id, data.fileIds);
  }

  @Put(':id/files/:fid')
  updateFile(
    @Param('mmid') mmid: string,
    @Param('id') id: string,
    @Param('fid') fid: string,
    @Body() data: { filename?: string; template?: string; language?: TemplateLanguage },
  ) {
    return this.service.updateFile(mmid, id, fid, data);
  }

  @Delete(':id/files/:fid')
  removeFile(
    @Param('mmid') mmid: string,
    @Param('id') id: string,
    @Param('fid') fid: string,
  ) {
    return this.service.removeFile(mmid, id, fid);
  }

  @Post(':id/generate')
  generate(@Param('mmid') mmid: string, @Param('id') id: string) {
    return this.service.generate(mmid, id);
  }
}
