/**
 * @emf-webapp/backend — OCLConstraintController
 *
 * REST endpoints para restricciones OCL, anidadas bajo metamodelos.
 *
 * GET    /api/metamodels/:mmid/constraints          — listar
 * POST   /api/metamodels/:mmid/constraints          — crear
 * GET    /api/metamodels/:mmid/constraints/:id      — obtener
 * PUT    /api/metamodels/:mmid/constraints/:id      — actualizar
 * DELETE /api/metamodels/:mmid/constraints/:id      — eliminar
 * POST   /api/metamodels/:mmid/constraints/validate — validar modelo
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { OCLConstraintService } from './oclconstraint.service.js';

@Controller('metamodels/:mmid/constraints')
export class OCLConstraintController {
  constructor(private readonly service: OCLConstraintService) {}

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
      context: string;
      expression: string;
      severity?: 'error' | 'warning' | 'info';
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
      context?: string;
      expression?: string;
      severity?: 'error' | 'warning' | 'info';
    },
  ) {
    return this.service.update(mmid, id, data);
  }

  @Delete(':id')
  remove(@Param('mmid') mmid: string, @Param('id') id: string) {
    return this.service.remove(mmid, id);
  }

  @Post('validate')
  async validate(
    @Param('mmid') mmid: string,
    @Body() body: { modelContent: string },
  ) {
    if (!body || !body.modelContent) {
      throw new BadRequestException(
        'Request body must include "modelContent" as a JSON string',
      );
    }
    try {
      return await this.service.validate(mmid, body.modelContent);
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(err.message || 'Validation failed');
    }
  }
}
