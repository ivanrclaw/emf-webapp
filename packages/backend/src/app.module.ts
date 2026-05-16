/**
 * @emf-webapp/backend — AppModule
 * Módulo raíz con TypeORM (SQLite), ProjectModule y MetamodelModule.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from './modules/project/project.module.js';
import { MetamodelModule } from './modules/metamodel/metamodel.module.js';
import { M1ModelModule } from './modules/m1model/m1model.module.js';
import { GraphicalSpecModule } from './modules/graphicalspec/graphicalspec.module.js';
import { OCLConstraintModule } from './modules/oclconstraint/oclconstraint.module.js';
import { CodeTemplateModule } from './modules/codetemplate/codetemplate.module.js';
import { Project } from './modules/project/project.entity.js';
import { Metamodel } from './modules/metamodel/metamodel.entity.js';
import { M1Model } from './modules/m1model/m1model.entity.js';
import { GraphicalSpec } from './modules/graphicalspec/graphicalspec.entity.js';
import { OCLConstraint } from './modules/oclconstraint/oclconstraint.entity.js';
import { CodeTemplate } from './modules/codetemplate/codetemplate.entity.js';
import { CollaborationModule } from './modules/collaboration/collaboration.module.js';
import { ModelVersionModule } from './modules/modelversion/modelversion.module.js';
import { ModelVersion } from './modules/modelversion/modelversion.entity.js';
import { XmiModule } from './modules/xmi/xmi.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './data/emf-webapp.db',
      entities: [Project, Metamodel, M1Model, GraphicalSpec, OCLConstraint, CodeTemplate, ModelVersion],
      synchronize: true,
    }),
    ProjectModule,
    MetamodelModule,
    M1ModelModule,
    GraphicalSpecModule,
    OCLConstraintModule,
    CodeTemplateModule,
    CollaborationModule,
    ModelVersionModule,
    XmiModule,
  ],
})
export class AppModule {}