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
import { Project } from './modules/project/project.entity.js';
import { Metamodel } from './modules/metamodel/metamodel.entity.js';
import { M1Model } from './modules/m1model/m1model.entity.js';
import { GraphicalSpec } from './modules/graphicalspec/graphicalspec.entity.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './data/emf-webapp.db',
      entities: [Project, Metamodel, M1Model, GraphicalSpec],
      synchronize: true,
    }),
    ProjectModule,
    MetamodelModule,
    M1ModelModule,
    GraphicalSpecModule,
  ],
})
export class AppModule {}
