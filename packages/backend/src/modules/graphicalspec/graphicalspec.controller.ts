/**
 * @emf-webapp/backend — GraphicalSpecController
 *
 * REST endpoints para especificaciones gráficas, anidadas bajo metamodelos.
 *
 * GET    /api/metamodels/:mmid/specs       — listar
 * POST   /api/metamodels/:mmid/specs       — crear
 * GET    /api/metamodels/:mmid/specs/:id   — obtener
 * PUT    /api/metamodels/:mmid/specs/:id   — actualizar
 * DELETE /api/metamodels/:mmid/specs/:id   — eliminar
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
import { GraphicalSpecService } from './graphicalspec.service.js';

@Controller('metamodels/:mmid/specs')
export class GraphicalSpecController {
  constructor(private readonly service: GraphicalSpecService) {}

  @Get()
  findAll(@Param('mmid') mmid: string) {
    return this.service.findAll(mmid);
  }

  @Post()
  create(
    @Param('mmid') mmid: string,
    @Body() data: { name: string; spec?: string },
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
    @Body() data: { name?: string; spec?: string },
  ) {
    return this.service.update(mmid, id, data);
  }

  @Delete(':id')
  remove(@Param('mmid') mmid: string, @Param('id') id: string) {
    return this.service.remove(mmid, id);
  }
}
