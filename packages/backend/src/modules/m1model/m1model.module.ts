/**
 * @emf-webapp/backend — M1Model Module
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { M1ModelController } from './m1model.controller.js';
import { M1ModelService } from './m1model.service.js';
import { M1Model } from './m1model.entity.js';
import { XmiModule } from '../xmi/xmi.module.js';
import { MetamodelModule } from '../metamodel/metamodel.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([M1Model]), XmiModule, MetamodelModule],
  controllers: [M1ModelController],
  providers: [M1ModelService],
  exports: [M1ModelService],
})
export class M1ModelModule {}
