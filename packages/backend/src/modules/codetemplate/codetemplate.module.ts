/**
 * @emf-webapp/backend — CodeTemplate Module
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeTemplateController } from './codetemplate.controller.js';
import { CodeTemplateService } from './codetemplate.service.js';
import { CodeTemplate } from './codetemplate.entity.js';
import { TemplateProject } from './template-project.entity.js';
import { TemplateProjectController } from './template-project.controller.js';
import { TemplateProjectService } from './template-project.service.js';
import { Metamodel } from '../metamodel/metamodel.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CodeTemplate, TemplateProject, Metamodel])],
  controllers: [CodeTemplateController, TemplateProjectController],
  providers: [CodeTemplateService, TemplateProjectService],
  exports: [CodeTemplateService, TemplateProjectService],
})
export class CodeTemplateModule {}
