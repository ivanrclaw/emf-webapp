/**
 * @emf-webapp/backend — CodeTemplateController
 *
 * REST endpoints para plantillas MTL y generadores predefinidos,
 * anidadas bajo metamodelos.
 *
 * GET    /api/metamodels/:mmid/templates                  — listar plantillas
 * POST   /api/metamodels/:mmid/templates                  — crear plantilla
 * GET    /api/metamodels/:mmid/templates/:id              — obtener plantilla
 * PUT    /api/metamodels/:mmid/templates/:id              — actualizar plantilla
 * DELETE /api/metamodels/:mmid/templates/:id              — eliminar plantilla
 * POST   /api/metamodels/:mmid/templates/:id/generate     — ejecutar plantilla personalizada
 * POST   /api/metamodels/:mmid/templates/generate/predefined — listar generadores predefinidos
 * POST   /api/metamodels/:mmid/templates/generate/:type   — ejecutar generador predefinido
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
import { CodeTemplateService } from './codetemplate.service.js';
import type { TemplateLanguage } from './codetemplate.entity.js';

@Controller('metamodels/:mmid/templates')
export class CodeTemplateController {
  constructor(private readonly service: CodeTemplateService) {}

  @Get()
  findAll(@Param('mmid') mmid: string) {
    return this.service.findAll(mmid);
  }

  @Post()
  create(
    @Param('mmid') mmid: string,
    @Body()
    data: {
      name: string;
      description?: string;
      template: string;
      language?: TemplateLanguage;
      is_predefined?: boolean;
    },
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
    @Body()
    data: {
      name?: string;
      description?: string;
      template?: string;
      language?: TemplateLanguage;
      is_predefined?: boolean;
    },
  ) {
    return this.service.update(mmid, id, data);
  }

  @Delete(':id')
  remove(@Param('mmid') mmid: string, @Param('id') id: string) {
    return this.service.remove(mmid, id);
  }

  @Post(':id/generate')
  generate(@Param('mmid') mmid: string, @Param('id') id: string) {
    return this.service.generate(mmid, id);
  }

  @Post('generate/predefined')
  getPredefinedTemplates() {
    return this.service.getPredefinedTemplates();
  }

  @Post('generate/:type')
  runPredefined(
    @Param('mmid') mmid: string,
    @Param('type') type: string,
  ) {
    return this.service.runPredefined(mmid, type);
  }
}
