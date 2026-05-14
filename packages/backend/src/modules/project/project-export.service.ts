/**
 * @emf-webapp/backend — ProjectExportService
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
import AdmZip = require('adm-zip');
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity.js';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { M1Model } from '../m1model/m1model.entity.js';
import { GraphicalSpec } from '../graphicalspec/graphicalspec.entity.js';
import { OCLConstraint } from '../oclconstraint/oclconstraint.entity.js';
import { CodeTemplate } from '../codetemplate/codetemplate.entity.js';

@Injectable()
export class ProjectExportService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Metamodel)
    private readonly metamodelRepo: Repository<Metamodel>,
    @InjectRepository(M1Model)
    private readonly modelRepo: Repository<M1Model>,
    @InjectRepository(GraphicalSpec)
    private readonly specRepo: Repository<GraphicalSpec>,
    @InjectRepository(OCLConstraint)
    private readonly constraintRepo: Repository<OCLConstraint>,
    @InjectRepository(CodeTemplate)
    private readonly templateRepo: Repository<CodeTemplate>,
  ) {}

  async exportProjectAsZip(projectId: string): Promise<Buffer> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with id "${projectId}" not found`);
    }

    const zip = new AdmZip();

    // Add project.json
    zip.addFile('project.json', Buffer.from(JSON.stringify(project, null, 2)));

    // Add metamodels
    const metamodels = await this.metamodelRepo.find({ where: { project_id: projectId } });
    for (const mm of metamodels) {
      const dir = `metamodels/${mm.name}`;
      zip.addFile(`${dir}/metamodel.json`, Buffer.from(JSON.stringify(mm, null, 2)));

      // Models (M1)
      const models = await this.modelRepo.find({ where: { metamodel_id: mm.id } });
      for (const model of models) {
        zip.addFile(`${dir}/models/${model.name}.json`, Buffer.from(JSON.stringify(model, null, 2)));
      }

      // Graphical Specs
      const specs = await this.specRepo.find({ where: { metamodel_id: mm.id } });
      for (const spec of specs) {
        zip.addFile(`${dir}/specs/${spec.name}.json`, Buffer.from(JSON.stringify(spec, null, 2)));
      }

      // OCL Constraints
      const constraints = await this.constraintRepo.find({ where: { metamodel_id: mm.id } });
      for (const constraint of constraints) {
        zip.addFile(`${dir}/constraints/${constraint.name}.json`, Buffer.from(JSON.stringify(constraint, null, 2)));
      }

      // Code Templates
      const templates = await this.templateRepo.find({ where: { metamodel_id: mm.id } });
      for (const template of templates) {
        zip.addFile(`${dir}/templates/${template.name}.json`, Buffer.from(JSON.stringify(template, null, 2)));
      }
    }

    return zip.toBuffer();
  }
}
