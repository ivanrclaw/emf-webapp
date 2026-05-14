/**
 * @emf-webapp/backend — AppModule
 * Módulo raíz con TypeORM (SQLite), ProjectModule y MetamodelModule.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from './modules/project/project.module.js';
import { MetamodelModule } from './modules/metamodel/metamodel.module.js';
import { Project } from './modules/project/project.entity.js';
import { Metamodel } from './modules/metamodel/metamodel.entity.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './data/emf-webapp.db',
      entities: [Project, Metamodel],
      synchronize: true,
    }),
    ProjectModule,
    MetamodelModule,
  ],
})
export class AppModule {}
