/**
 * @emf-webapp/backend — ProjectExportService
 *
 * Genera un ZIP con el proyecto completo: proyecto, metamodelos, modelos,
 * especificaciones gráficas, constraints OCL y plantillas de código.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import archiver = require('archiver');
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

    return new Promise<Buffer>(async (resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err) => reject(err));

      // Add project.json
      archive.append(JSON.stringify(project, null, 2), { name: 'project.json' });

      // Add metamodels
      const metamodels = await this.metamodelRepo.find({ where: { project_id: projectId } });
      for (const mm of metamodels) {
        const dir = `metamodels/${mm.name}`;
        archive.append(JSON.stringify(mm, null, 2), { name: `${dir}/metamodel.json` });

        // Models (M1)
        const models = await this.modelRepo.find({ where: { metamodel_id: mm.id } });
        for (const model of models) {
          archive.append(JSON.stringify(model, null, 2), {
            name: `${dir}/models/${model.name}.json`,
          });
        }

        // Graphical Specs
        const specs = await this.specRepo.find({ where: { metamodel_id: mm.id } });
        for (const spec of specs) {
          archive.append(JSON.stringify(spec, null, 2), {
            name: `${dir}/specs/${spec.name}.json`,
          });
        }

        // OCL Constraints
        const constraints = await this.constraintRepo.find({ where: { metamodel_id: mm.id } });
        for (const constraint of constraints) {
          archive.append(JSON.stringify(constraint, null, 2), {
            name: `${dir}/constraints/${constraint.name}.json`,
          });
        }

        // Code Templates
        const templates = await this.templateRepo.find({ where: { metamodel_id: mm.id } });
        for (const template of templates) {
          archive.append(JSON.stringify(template, null, 2), {
            name: `${dir}/templates/${template.name}.json`,
          });
        }
      }

      await archive.finalize();
    });
  }
}
