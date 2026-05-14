/**
 * @emf-webapp/backend — MetamodelService
 *
 * CRUD completo de metamodelos con TypeORM Repository.
 * Todos los endpoints están scoped bajo un project_id.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metamodel } from './metamodel.entity.js';

@Injectable()
export class MetamodelService {
  constructor(
    @InjectRepository(Metamodel)
    private readonly repo: Repository<Metamodel>,
  ) {}

  /**
   * Lista todos los metamodelos de un proyecto.
   */
  async findAll(projectId: string): Promise<Metamodel[]> {
    return this.repo.find({
      where: { project_id: projectId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtiene un metamodelo por su ID dentro de un proyecto.
   */
  async findOne(projectId: string, id: string): Promise<Metamodel> {
    const mm = await this.repo.findOne({
      where: { id, project_id: projectId },
    });
    if (!mm) {
      throw new NotFoundException(
        `Metamodel with id "${id}" not found in project "${projectId}"`,
      );
    }
    return mm;
  }

  /**
   * Crea un nuevo metamodelo asociado a un proyecto.
   */
  async create(
    projectId: string,
    data: {
      name: string;
      nsURI?: string;
      nsPrefix?: string;
      content?: Record<string, any>;
    },
  ): Promise<Metamodel> {
    const safeName = data.name.trim().toLowerCase().replace(/\\s+/g, '-');
    const mm = this.repo.create({
      project_id: projectId,
      name: data.name,
      ns_uri: data.nsURI || `http://${safeName}.emf-webapp/1.0`,
      ns_prefix: data.nsPrefix || safeName,
      content: data.content || {},
    });
    return this.repo.save(mm);
  }

  /**
   * Actualiza los campos de un metamodelo existente.
   */
  async update(
    projectId: string,
    id: string,
    data: {
      name?: string;
      nsURI?: string;
      nsPrefix?: string;
      content?: Record<string, any>;
    },
  ): Promise<Metamodel> {
    const mm = await this.findOne(projectId, id);
    if (data.name !== undefined) mm.name = data.name;
    if (data.nsURI !== undefined) mm.ns_uri = data.nsURI;
    if (data.nsPrefix !== undefined) mm.ns_prefix = data.nsPrefix;
    if (data.content !== undefined) mm.content = data.content;
    return this.repo.save(mm);
  }

  /**
   * Elimina un metamodelo por su ID.
   */
  async remove(projectId: string, id: string): Promise<void> {
    const mm = await this.findOne(projectId, id);
    await this.repo.remove(mm);
  }
}
