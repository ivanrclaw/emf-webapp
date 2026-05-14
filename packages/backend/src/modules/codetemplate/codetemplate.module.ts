/**
 * @emf-webapp/backend — CodeTemplate Module
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeTemplateController } from './codetemplate.controller.js';
import { CodeTemplateService } from './codetemplate.service.js';
import { CodeTemplate } from './codetemplate.entity.js';
import { Metamodel } from '../metamodel/metamodel.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CodeTemplate, Metamodel])],
  controllers: [CodeTemplateController],
  providers: [CodeTemplateService],
  exports: [CodeTemplateService],
})
export class CodeTemplateModule {}
