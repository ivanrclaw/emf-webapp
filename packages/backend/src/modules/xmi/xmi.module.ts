/**
 * @emf-webapp/backend — XmiModule
 *
 * Módulo que expone los servicios y controladores XMI.
 * Incluye soporte para OCL constraints y XMI instances.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { OCLConstraint } from '../oclconstraint/oclconstraint.entity.js';
import { XmiController } from './xmi.controller.js';
import { XmiService } from './xmi.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Metamodel, OCLConstraint])],
  controllers: [XmiController],
  providers: [XmiService],
  exports: [XmiService],
})
export class XmiModule {}
