/**
 * @emf-webapp/backend — MetamodelModule
 *
 * Registra MetamodelController, MetamodelService, EcoreTransformer
 * y la entidad Metamodel en TypeORM.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetamodelController } from './metamodel.controller.js';
import { MetamodelService } from './metamodel.service.js';
import { Metamodel } from './metamodel.entity.js';
import { EcoreTransformer } from '../../common/ecore-transformer.js';

@Module({
  imports: [TypeOrmModule.forFeature([Metamodel])],
  controllers: [MetamodelController],
  providers: [MetamodelService, EcoreTransformer],
  exports: [MetamodelService],
})
export class MetamodelModule {}
