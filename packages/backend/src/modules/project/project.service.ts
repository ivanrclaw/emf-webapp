/**
 * @emf-webapp/backend — ProjectService
 *
 * CRUD completo de proyectos con TypeORM Repository.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity.js';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
  ) {}

  /**
   * Lista todos los proyectos paginados, ordenados por fecha de creación descendente.
   */
  async findAll(page: number = 1, limit: number = 20): Promise<{
    items: Project[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [items, total] = await this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { items, total, page, limit };
  }

  /**
   * Obtiene un proyecto por su ID.
   */
  async findOne(id: string): Promise<Project> {
    const project = await this.repo.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with id "${id}" not found`);
    }
    return project;
  }

  /**
   * Crea un nuevo proyecto.
   */
  async create(data: { name: string; description?: string }): Promise<Project> {
    const project = this.repo.create(data);
    return this.repo.save(project);
  }

  /**
   * Actualiza los campos de un proyecto existente.
   */
  async update(id: string, data: { name?: string; description?: string }): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, data);
    return this.repo.save(project);
  }

  /**
   * Elimina un proyecto por su ID.
   */
  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    await this.repo.remove(project);
  }
}
