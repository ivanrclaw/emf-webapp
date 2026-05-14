/**
 * @emf-webapp/backend — ProjectModule
 *
 * Registra ProjectController, ProjectService y la entidad Project en TypeORM.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller.js';
import { ProjectService } from './project.service.js';
import { Project } from './project.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
