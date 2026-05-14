/**
 * @emf-webapp/backend — GraphicalSpec Module
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphicalSpecController } from './graphicalspec.controller.js';
import { GraphicalSpecService } from './graphicalspec.service.js';
import { GraphicalSpec } from './graphicalspec.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([GraphicalSpec])],
  controllers: [GraphicalSpecController],
  providers: [GraphicalSpecService],
  exports: [GraphicalSpecService],
})
export class GraphicalSpecModule {}
