/**
 * @emf-webapp/backend — M1ModelService
 *
 * CRUD de modelos M1 (instancias), scoped bajo project + metamodel.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { M1Model } from './m1model.entity.js';

@Injectable()
export class M1ModelService {
  constructor(
    @InjectRepository(M1Model)
    private readonly repo: Repository<M1Model>,
  ) {}

  async findAll(projectId: string, metamodelId: string): Promise<M1Model[]> {
    return this.repo.find({
      where: { project_id: projectId, metamodel_id: metamodelId },
      order: { name: 'ASC' },
    });
  }

  async findOne(
    projectId: string,
    metamodelId: string,
    id: string,
  ): Promise<M1Model> {
    const model = await this.repo.findOne({
      where: { id, project_id: projectId, metamodel_id: metamodelId },
    });
    if (!model) {
      throw new NotFoundException(
        `M1Model "${id}" not found in project "${projectId}" / metamodel "${metamodelId}"`,
      );
    }
    return model;
  }

  async create(
    projectId: string,
    metamodelId: string,
    data: { name: string; content?: any },
  ): Promise<M1Model> {
    const model = this.repo.create({
      project_id: projectId,
      metamodel_id: metamodelId,
      name: data.name,
      content: data.content ?? '[]',
    });
    const saved = await this.repo.save(model);
    // Re-fetch to ensure transformer 'from' is applied on the response
    return this.findOne(projectId, metamodelId, saved.id);
  }

  async update(
    projectId: string,
    metamodelId: string,
    id: string,
    data: { name?: string; content?: any },
  ): Promise<M1Model> {
    const model = await this.findOne(projectId, metamodelId, id);
    if (data.name !== undefined) model.name = data.name;
    if (data.content !== undefined) model.content = data.content;
    await this.repo.save(model);
    // Re-fetch to ensure transformer 'from' is applied on the response
    return this.findOne(projectId, metamodelId, id);
  }

  async remove(
    projectId: string,
    metamodelId: string,
    id: string,
  ): Promise<void> {
    const model = await this.findOne(projectId, metamodelId, id);
    await this.repo.remove(model);
  }
}
