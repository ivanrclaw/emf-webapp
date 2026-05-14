/**
 * @emf-webapp/backend — OCLConstraint Module
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OCLConstraintController } from './oclconstraint.controller.js';
import { OCLConstraintService } from './oclconstraint.service.js';
import { OCLConstraint } from './oclconstraint.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([OCLConstraint])],
  controllers: [OCLConstraintController],
  providers: [OCLConstraintService],
  exports: [OCLConstraintService],
})
export class OCLConstraintModule {}
