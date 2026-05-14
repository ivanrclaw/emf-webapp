/**
 * @emf-webapp/backend — GraphicalSpecService
 *
 * CRUD de especificaciones gráficas (Sirius-like), scoped bajo metamodel.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphicalSpec } from './graphicalspec.entity.js';

@Injectable()
export class GraphicalSpecService {
  constructor(
    @InjectRepository(GraphicalSpec)
    private readonly repo: Repository<GraphicalSpec>,
  ) {}

  async findAll(metamodelId: string): Promise<GraphicalSpec[]> {
    return this.repo.find({
      where: { metamodel_id: metamodelId },
      order: { name: 'ASC' },
    });
  }

  async findOne(metamodelId: string, id: string): Promise<GraphicalSpec> {
    const spec = await this.repo.findOne({
      where: { id, metamodel_id: metamodelId },
    });
    if (!spec) {
      throw new NotFoundException(
        `GraphicalSpec "${id}" not found in metamodel "${metamodelId}"`,
      );
    }
    return spec;
  }

  async create(
    metamodelId: string,
    data: { name: string; spec?: string },
  ): Promise<GraphicalSpec> {
    const spec = this.repo.create({
      metamodel_id: metamodelId,
      name: data.name,
      spec: data.spec || '{}',
    });
    return this.repo.save(spec);
  }

  async update(
    metamodelId: string,
    id: string,
    data: { name?: string; spec?: string },
  ): Promise<GraphicalSpec> {
    const spec = await this.findOne(metamodelId, id);
    if (data.name !== undefined) spec.name = data.name;
    if (data.spec !== undefined) spec.spec = data.spec;
    return this.repo.save(spec);
  }

  async remove(metamodelId: string, id: string): Promise<void> {
    const spec = await this.findOne(metamodelId, id);
    await this.repo.remove(spec);
  }
}
