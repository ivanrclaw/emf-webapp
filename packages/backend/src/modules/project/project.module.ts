/**
 * @emf-webapp/backend — ProjectModule
 *
 * Registra ProjectController, ProjectService y la entidad Project en TypeORM.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller.js';
import { ProjectService } from './project.service.js';
import { ProjectExportService } from './project-export.service.js';
import { ProjectImportService } from './project-import.service.js';
import { EcoreTransformer } from '../../common/ecore-transformer.js';
import { Project } from './project.entity.js';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { M1Model } from '../m1model/m1model.entity.js';
import { GraphicalSpec } from '../graphicalspec/graphicalspec.entity.js';
import { OCLConstraint } from '../oclconstraint/oclconstraint.entity.js';
import { CodeTemplate } from '../codetemplate/codetemplate.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Metamodel, M1Model, GraphicalSpec, OCLConstraint, CodeTemplate])],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectExportService, ProjectImportService, EcoreTransformer],
  exports: [ProjectService, ProjectExportService, ProjectImportService],
})
export class ProjectModule {}
