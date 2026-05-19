/**
 * @emf-webapp/backend — TemplateProjectService
 *
 * CRUD and generation logic for multi-file template projects.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateProject } from './template-project.entity.js';
import { CodeTemplate, TemplateLanguage } from './codetemplate.entity.js';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { MTLParser, MTLExecutor } from '@emf-webapp/core';
import type { MTLExecutionResult } from '@emf-webapp/core';

@Injectable()
export class TemplateProjectService {
  constructor(
    @InjectRepository(TemplateProject)
    private readonly projectRepo: Repository<TemplateProject>,
    @InjectRepository(CodeTemplate)
    private readonly fileRepo: Repository<CodeTemplate>,
    @InjectRepository(Metamodel)
    private readonly metamodelRepo: Repository<Metamodel>,
  ) {}

  // ================================================================
  // Project CRUD
  // ================================================================

  async findAll(mmid: string): Promise<(TemplateProject & { fileCount: number })[]> {
    const projects = await this.projectRepo.find({
      where: { metamodel_id: mmid },
      order: { name: 'ASC' },
      relations: ['files'],
    });
    return projects.map((p) => ({
      ...p,
      fileCount: p.files?.length ?? 0,
    }));
  }

  async findOne(mmid: string, id: string): Promise<TemplateProject> {
    const project = await this.projectRepo.findOne({
      where: { id, metamodel_id: mmid },
      relations: ['files'],
    });
    if (!project) {
      throw new NotFoundException(
        `TemplateProject "${id}" not found in metamodel "${mmid}"`,
      );
    }
    // Sort files by file_order
    if (project.files) {
      project.files.sort((a, b) => a.file_order - b.file_order);
    }
    return project;
  }

  async create(
    mmid: string,
    data: { name: string; description?: string; metamodelUri?: string; rootType?: string },
  ): Promise<TemplateProject> {
    const project = this.projectRepo.create({
      metamodel_id: mmid,
      name: data.name,
      description: data.description ?? null,
    });
    const savedProject = await this.projectRepo.save(project);

    // Scaffold a main.mtl file with starter Acceleo content
    const metamodelUri = data.metamodelUri || 'http://example.org/metamodel/1.0';
    const rootType = data.rootType || 'EPackage';
    const mainTemplate = `[comment encoding = UTF-8 /]
[module main('${metamodelUri}')/]

[comment @main /]
[template public main(model : ${rootType})]
[comment Iterate over classes and generate a file for each /]
[for (c : EClass | model.eClassifiers->filter(EClass))]
[c.generateClass()/]
[/for]
[/template]

[template public generateClass(c : EClass)]
[file (c.name.toLowerFirst().concat('.java'), overwrite, 'UTF-8')]
// Generated from [c.name/]
public class [c.name/] {
[for (attr : EAttribute | c.eStructuralFeatures->filter(EAttribute))]
  private [attr.eType.name/] [attr.name/];
[/for]
}
[/file]
[/template]`;

    const mainFile = this.fileRepo.create({
      metamodel_id: mmid,
      project_id: savedProject.id,
      name: 'main.mtl',
      filename: 'main.mtl',
      template: mainTemplate,
      language: 'html',
      file_order: 0,
      is_predefined: false,
    });
    await this.fileRepo.save(mainFile);

    return savedProject;
  }

  async update(
    mmid: string,
    id: string,
    data: { name?: string; description?: string },
  ): Promise<TemplateProject> {
    const project = await this.findOne(mmid, id);
    if (data.name !== undefined) project.name = data.name;
    if (data.description !== undefined) project.description = data.description;
    return this.projectRepo.save(project);
  }

  async remove(mmid: string, id: string): Promise<void> {
    const project = await this.findOne(mmid, id);
    // Delete all files in the project first
    if (project.files && project.files.length > 0) {
      await this.fileRepo.remove(project.files);
    }
    await this.projectRepo.remove(project);
  }

  // ================================================================
  // File management within a project
  // ================================================================

  async addFile(
    mmid: string,
    projectId: string,
    data: { filename: string; template: string; language?: TemplateLanguage },
  ): Promise<CodeTemplate> {
    // Verify project exists
    const project = await this.findOne(mmid, projectId);

    // Check for duplicate filename
    const duplicate = project.files?.find((f) => f.filename === data.filename);
    if (duplicate) {
      throw new BadRequestException('A file with this name already exists in this location');
    }

    // Determine next file_order
    const maxOrder = project.files?.length
      ? Math.max(...project.files.map((f) => f.file_order))
      : -1;

    const file = this.fileRepo.create({
      metamodel_id: mmid,
      project_id: projectId,
      name: data.filename,
      filename: data.filename,
      template: data.template,
      language: data.language || 'html',
      file_order: maxOrder + 1,
      is_predefined: false,
    });
    return this.fileRepo.save(file);
  }

  async updateFile(
    mmid: string,
    projectId: string,
    fileId: string,
    data: { filename?: string; template?: string; language?: TemplateLanguage },
  ): Promise<CodeTemplate> {
    const file = await this.fileRepo.findOne({
      where: { id: fileId, metamodel_id: mmid, project_id: projectId },
    });
    if (!file) {
      throw new NotFoundException(
        `File "${fileId}" not found in project "${projectId}"`,
      );
    }
    if (data.filename !== undefined) {
      // Check for duplicate filename (exclude current file)
      const existingFile = await this.fileRepo.findOne({
        where: { metamodel_id: mmid, project_id: projectId, filename: data.filename },
      });
      if (existingFile && existingFile.id !== fileId) {
        throw new BadRequestException('A file with this name already exists in this location');
      }
      file.filename = data.filename;
      file.name = data.filename;
    }
    if (data.template !== undefined) file.template = data.template;
    if (data.language !== undefined) file.language = data.language;
    return this.fileRepo.save(file);
  }

  async removeFile(mmid: string, projectId: string, fileId: string): Promise<void> {
    const file = await this.fileRepo.findOne({
      where: { id: fileId, metamodel_id: mmid, project_id: projectId },
    });
    if (!file) {
      throw new NotFoundException(
        `File "${fileId}" not found in project "${projectId}"`,
      );
    }
    await this.fileRepo.remove(file);
  }

  async reorderFiles(mmid: string, projectId: string, fileIds: string[]): Promise<void> {
    // Verify project exists
    await this.findOne(mmid, projectId);

    // Update file_order based on array position
    for (let i = 0; i < fileIds.length; i++) {
      await this.fileRepo.update(
        { id: fileIds[i], project_id: projectId },
        { file_order: i },
      );
    }
  }

  // ================================================================
  // Project generation (multi-file MTL execution)
  // ================================================================

  async generate(
    mmid: string,
    projectId: string,
  ): Promise<{ files: Array<{ name: string; content: string }> }> {
    // 1. Load project with all files
    const project = await this.findOne(mmid, projectId);
    if (!project.files || project.files.length === 0) {
      throw new BadRequestException('Project has no template files');
    }

    // 2. Load metamodel
    const metamodel = await this.metamodelRepo.findOne({
      where: { id: mmid },
    });
    if (!metamodel) {
      throw new NotFoundException(`Metamodel "${mmid}" not found`);
    }

    // 3. Build model object from metamodel
    const modelObject = this.buildModelFromMetamodel(metamodel);

    // 4. Find the @main template file (first file or one containing [module main])
    const mainFile = this.findMainFile(project.files);
    if (!mainFile) {
      throw new BadRequestException(
        'No main template file found. Mark a file with [module main/] or use the first file.',
      );
    }

    // 5. Resolve imports: build a combined template by inlining imported modules
    const resolvedTemplate = this.resolveImports(mainFile, project.files);

    // 6. Parse and execute
    const ast = MTLParser.parse(resolvedTemplate);
    if (ast.length === 0) {
      return { files: [] };
    }

    const executor = new MTLExecutor();
    const result: MTLExecutionResult = executor.execute(ast, modelObject as any, { enableLogging: true });

    if (result.error) {
      throw new BadRequestException(`Template execution error: ${result.error}`);
    }

    // Build response with logging data
    const response: any = { files: [] as Array<{ name: string; content: string }> };

    if (result.files.length > 0) {
      response.files = result.files;
    } else {
      const output = result.output ?? '';
      if (output.trim()) {
        response.files = [{ name: `${project.name}-output.txt`, content: output }];
      }
    }

    // Attach execution metadata
    if (result.log) response.log = result.log;
    if (result.traces) response.traces = result.traces;
    if (result.executionTime != null) response.executionTime = result.executionTime;
    if (result.stats) response.stats = result.stats;

    return response;
  }

  // ================================================================
  // Private helpers
  // ================================================================

  private buildModelFromMetamodel(metamodel: Metamodel): Record<string, any> {
    const content = metamodel.content;
    return {
      name: metamodel.name,
      nsURI: metamodel.ns_uri,
      nsPrefix: metamodel.ns_prefix,
      ...content,
    };
  }

  /**
   * Find the main template file in the project.
   * Priority: file containing [module main/], then first file by file_order.
   */
  private findMainFile(files: CodeTemplate[]): CodeTemplate | null {
    // Look for a file that declares itself as main
    const mainByModule = files.find(
      (f) => /\[module\s+main\s*\/?\]/.test(f.template),
    );
    if (mainByModule) return mainByModule;

    // Look for a file named main.mtl
    const mainByName = files.find(
      (f) => f.filename === 'main.mtl' || f.filename === 'main',
    );
    if (mainByName) return mainByName;

    // Default to first file by order
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Resolve [import X/] directives by inlining the content of referenced modules.
   * A module is identified by a [module NAME/] declaration in its template content,
   * or by its filename (without extension).
   */
  private resolveImports(mainFile: CodeTemplate, allFiles: CodeTemplate[]): string {
    const visited = new Set<string>();
    return this.resolveFileImports(mainFile, allFiles, visited);
  }

  private resolveFileImports(
    file: CodeTemplate,
    allFiles: CodeTemplate[],
    visited: Set<string>,
  ): string {
    const fileKey = file.id;
    if (visited.has(fileKey)) return ''; // Prevent circular imports
    visited.add(fileKey);

    let template = file.template;

    // Find all [import X/] directives
    const importRegex = /\[import\s+([\w:]+)\s*\/?]/g;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(template)) !== null) {
      const moduleName = match[1];
      const importedFile = this.findModuleFile(moduleName, allFiles);

      if (importedFile) {
        // Recursively resolve imports in the imported file
        const importedContent = this.resolveFileImports(importedFile, allFiles, visited);
        // Replace the import directive with the imported content
        template = template.replace(match[0], importedContent);
        // Reset regex since we modified the string
        importRegex.lastIndex = 0;
      }
    }

    return template;
  }

  /**
   * Find a file by its module name.
   * Checks [module NAME/] declarations first, then filename match.
   */
  private findModuleFile(moduleName: string, files: CodeTemplate[]): CodeTemplate | undefined {
    // Handle qualified names with :: separator (e.g., common::utils -> common/utils.mtl)
    if (moduleName.includes('::')) {
      const pathName = moduleName.replace(/::/g, '/') + '.mtl';
      const byPath = files.find((f) => f.filename === pathName);
      if (byPath) return byPath;
    }

    // Check for [module NAME/] declaration
    const byDeclaration = files.find((f) => {
      const moduleRegex = new RegExp(`\\[module\\s+${moduleName}\\s*\\/?\\]`);
      return moduleRegex.test(f.template);
    });
    if (byDeclaration) return byDeclaration;

    // Check by filename (with or without extension)
    return files.find((f) => {
      const nameWithoutExt = f.filename.replace(/\.\w+$/, '');
      return nameWithoutExt === moduleName || f.filename === moduleName;
    });
  }
}
