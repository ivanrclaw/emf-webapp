/**
 * @emf-webapp/backend — ModelVersionModule
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelVersionController } from './modelversion.controller.js';
import { ModelVersionService } from './modelversion.service.js';
import { ModelVersion } from './modelversion.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ModelVersion])],
  controllers: [ModelVersionController],
  providers: [ModelVersionService],
  exports: [ModelVersionService],
})
export class ModelVersionModule {}
