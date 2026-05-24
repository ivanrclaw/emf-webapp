/**
 * @emf-webapp/backend — ProjectImportService
 *
 * Imports Eclipse project bundles (ZIP) into emf-webapp.
 * Supports importing:
 *   - .ecore metamodels (via parseEcoreXmi)
 *   - .ocl constraints (via parseCompleteOCL)
 *   - .odesign graphical specs (via parseOdesign)
 *   - .xmi model instances (via importXmiInstance)
 *   - .emf Emfatic files (via parseEmfatic)
 *   - .mtl Acceleo templates (basic extraction)
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
import AdmZip = require('adm-zip');
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity.js';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { M1Model } from '../m1model/m1model.entity.js';
import { GraphicalSpec } from '../graphicalspec/graphicalspec.entity.js';
import { OCLConstraint } from '../oclconstraint/oclconstraint.entity.js';
import { CodeTemplate } from '../codetemplate/codetemplate.entity.js';
import {
  parseEcoreXmi,
  parseCompleteOCL,
  parseOdesign,
  parseEmfatic,
  importXmiInstance,
  type SerializableEPackage,
} from '@emf-webapp/core/serialization';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ImportResult {
  projectId: string;
  projectName: string;
  metamodels: { id: string; name: string }[];
  models: { id: string; name: string }[];
  constraints: number;
  specs: number;
  templates: number;
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════

@Injectable()
export class ProjectImportService {
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

  /**
   * Imports an Eclipse project ZIP into emf-webapp.
   * Detects project structure and imports all recognized artifacts.
   */
  async importEclipseProject(
    zipBuffer: Buffer,
    projectName?: string,
  ): Promise<ImportResult> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const warnings: string[] = [];

    if (entries.length === 0) {
      throw new BadRequestException('ZIP file is empty');
    }

    // Detect project root (may be nested in a folder)
    const projectRoot = this.detectProjectRoot(entries);

    // Extract project name from .project file or use provided name
    const resolvedName = projectName || this.extractProjectName(zip, projectRoot) || 'Imported Project';

    // Create project
    const project = await this.projectRepo.save(
      this.projectRepo.create({ name: resolvedName }),
    );

    const result: ImportResult = {
      projectId: project.id,
      projectName: resolvedName,
      metamodels: [],
      models: [],
      constraints: 0,
      specs: 0,
      templates: 0,
      warnings,
    };

    // ─── 1. Find and import .ecore files ──────────────────────
    const ecoreEntries = entries.filter(e =>
      e.entryName.endsWith('.ecore') && !e.isDirectory
    );

    const metamodelMap = new Map<string, { id: string; content: SerializableEPackage }>();

    for (const entry of ecoreEntries) {
      try {
        const xml = entry.getData().toString('utf-8');
        const parsed = parseEcoreXmi(xml);

        const mm = await this.metamodelRepo.save(
          this.metamodelRepo.create({
            project_id: project.id,
            name: parsed.name || this.fileBaseName(entry.entryName),
            ns_uri: parsed.nsURI || '',
            ns_prefix: parsed.nsPrefix || '',
            content: parsed as any,
          }),
        );

        metamodelMap.set(mm.name, { id: mm.id, content: parsed });
        result.metamodels.push({ id: mm.id, name: mm.name });
      } catch (err) {
        warnings.push(`Failed to parse ${entry.entryName}: ${(err as Error).message}`);
      }
    }

    // ─── 1b. Fallback: try .emf files if no .ecore found ─────
    if (ecoreEntries.length === 0) {
      const emfEntries = entries.filter(e =>
        e.entryName.endsWith('.emf') && !e.isDirectory
      );

      for (const entry of emfEntries) {
        try {
          const text = entry.getData().toString('utf-8');
          const parsed = parseEmfatic(text);

          const mm = await this.metamodelRepo.save(
            this.metamodelRepo.create({
              project_id: project.id,
              name: parsed.name || this.fileBaseName(entry.entryName),
              ns_uri: parsed.nsURI || '',
              ns_prefix: parsed.nsPrefix || '',
              content: parsed as any,
            }),
          );

          metamodelMap.set(mm.name, { id: mm.id, content: parsed });
          result.metamodels.push({ id: mm.id, name: mm.name });
        } catch (err) {
          warnings.push(`Failed to parse ${entry.entryName}: ${(err as Error).message}`);
        }
      }
    }

    // Get first metamodel for associating constraints/specs/models
    const firstMM = result.metamodels[0];
    const firstMMId = firstMM?.id;

    // ─── 2. Import .ocl files ─────────────────────────────────
    if (firstMMId) {
      const oclEntries = entries.filter(e =>
        e.entryName.endsWith('.ocl') && !e.isDirectory
      );

      for (const entry of oclEntries) {
        try {
          const text = entry.getData().toString('utf-8');
          const parsed = parseCompleteOCL(text);

          for (const constraint of parsed.constraints) {
            await this.constraintRepo.save(
              this.constraintRepo.create({
                metamodel_id: firstMMId,
                name: constraint.name,
                context: constraint.context,
                expression: constraint.expression,
                severity: constraint.severity,
              }),
            );
            result.constraints++;
          }
        } catch (err) {
          warnings.push(`Failed to parse ${entry.entryName}: ${(err as Error).message}`);
        }
      }
    }

    // ─── 3. Import .odesign files ─────────────────────────────
    if (firstMMId) {
      const odesignEntries = entries.filter(e =>
        e.entryName.endsWith('.odesign') && !e.isDirectory
      );

      for (const entry of odesignEntries) {
        try {
          const xml = entry.getData().toString('utf-8');
          const parsed = parseOdesign(xml);

          for (const vp of parsed.viewpoints) {
            const specJson = JSON.stringify({
              id: `vsp_${Date.now()}`,
              name: vp.name,
              diagram: vp.diagram,
              defaultLayer: this.convertParsedLayer(vp.defaultLayer),
              additionalLayers: vp.additionalLayers.map(l => this.convertParsedLayer(l)),
            });

            await this.specRepo.save(
              this.specRepo.create({
                metamodel_id: firstMMId,
                name: vp.name || this.fileBaseName(entry.entryName),
                spec: specJson,
              }),
            );
            result.specs++;
          }
        } catch (err) {
          warnings.push(`Failed to parse ${entry.entryName}: ${(err as Error).message}`);
        }
      }
    }

    // ─── 4. Import .xmi model instances ───────────────────────
    if (firstMMId) {
      const xmiEntries = entries.filter(e =>
        e.entryName.endsWith('.xmi') && !e.isDirectory &&
        !e.entryName.includes('.ecore') // exclude ecore xmi
      );

      const firstMMContent = metamodelMap.values().next().value?.content;

      for (const entry of xmiEntries) {
        try {
          const xml = entry.getData().toString('utf-8');
          const modelName = this.fileBaseName(entry.entryName);

          let content: any = [];
          if (firstMMContent) {
            try {
              const doc = importXmiInstance(xml, firstMMContent);
              content = [this.flattenXmiInstance(doc.root)];
            } catch {
              // Fallback: store raw XML reference
              content = [{ _rawXmi: xml }];
            }
          }

          const model = await this.modelRepo.save(
            this.modelRepo.create({
              project_id: project.id,
              metamodel_id: firstMMId,
              name: modelName,
              content,
            }),
          );

          result.models.push({ id: model.id, name: modelName });
        } catch (err) {
          warnings.push(`Failed to import ${entry.entryName}: ${(err as Error).message}`);
        }
      }
    }

    // ─── 5. Import .mtl Acceleo templates ─────────────────────
    if (firstMMId) {
      const mtlEntries = entries.filter(e =>
        e.entryName.endsWith('.mtl') && !e.isDirectory
      );

      for (const entry of mtlEntries) {
        try {
          const text = entry.getData().toString('utf-8');
          const templateName = this.fileBaseName(entry.entryName);

          await this.templateRepo.save(
            this.templateRepo.create({
              metamodel_id: firstMMId,
              name: templateName,
              content: text,
            } as any),
          );
          result.templates++;
        } catch (err) {
          warnings.push(`Failed to import ${entry.entryName}: ${(err as Error).message}`);
        }
      }
    }

    result.warnings = warnings;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  private detectProjectRoot(entries: AdmZip.IZipEntry[]): string {
    // Look for .project file to determine root
    const projectFile = entries.find(e => e.entryName.endsWith('.project') && !e.isDirectory);
    if (projectFile) {
      const parts = projectFile.entryName.split('/');
      if (parts.length > 1) {
        return parts.slice(0, -1).join('/') + '/';
      }
    }
    return '';
  }

  private extractProjectName(zip: AdmZip, root: string): string | null {
    const projectEntry = zip.getEntry(`${root}.project`);
    if (!projectEntry) return null;

    const xml = projectEntry.getData().toString('utf-8');
    const nameMatch = xml.match(/<name>([^<]+)<\/name>/);
    return nameMatch ? nameMatch[1] : null;
  }

  private fileBaseName(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^.]+$/, '');
  }

  private convertParsedLayer(layer: any): any {
    return {
      id: `layer_${layer.name?.replace(/\s+/g, '_').toLowerCase() || 'default'}`,
      name: layer.name || 'Default',
      isDefault: layer.name === 'Default' || !layer.name,
      activeByDefault: true,
      nodeMappings: (layer.nodeMappings || []).map((nm: any) => ({
        id: nm.id || `node_${nm.domainClass}`,
        domainClass: nm.domainClass,
        semanticCandidatesExpression: nm.semanticCandidatesExpression || '',
        labelExpression: nm.labelExpression || nm.defaultStyle?.labelExpression || 'self.name',
        defaultStyle: nm.defaultStyle || {},
        conditionalStyles: [],
      })),
      containerMappings: (layer.containerMappings || []).map((cm: any) => ({
        id: cm.id || `container_${cm.domainClass}`,
        domainClass: cm.domainClass,
        semanticCandidatesExpression: cm.semanticCandidatesExpression || '',
        labelExpression: cm.labelExpression || cm.defaultStyle?.labelExpression || 'self.name',
        childrenPresentation: cm.childrenPresentation || 'FreeForm',
        subNodeMappingIds: [],
        subContainerMappingIds: [],
        defaultStyle: cm.defaultStyle || {},
        conditionalStyles: [],
      })),
      edgeMappings: (layer.edgeMappings || []).map((em: any) => ({
        id: em.id || `edge_${em.domainClass || 'ref'}`,
        type: em.type || 'relation-based',
        domainClass: em.domainClass,
        sourceReference: em.sourceReference,
        sourceMappingIds: em.sourceMappingIds || [],
        targetMappingIds: em.targetMappingIds || [],
        targetFinderExpression: em.targetFinderExpression || '',
        sourceFinderExpression: em.sourceFinderExpression,
        defaultStyle: em.defaultStyle || {},
        conditionalStyles: [],
      })),
      toolSections: (layer.toolSections || []).map((ts: any) => ({
        id: `tools_${ts.label?.replace(/\s+/g, '_').toLowerCase() || 'default'}`,
        label: ts.label || 'Tools',
        tools: (ts.tools || []).map((t: any) => ({
          id: `tool_${t.label?.replace(/\s+/g, '_').toLowerCase() || 'unknown'}`,
          type: this.mapToolType(t.type),
          label: t.label || 'Tool',
          createType: t.createType,
          containmentReference: t.containmentReference,
          featureToSet: t.featureToSet,
        })),
      })),
    };
  }

  private mapToolType(siriusType: string): string {
    switch (siriusType) {
      case 'NodeCreationDescription': return 'nodeCreation';
      case 'ContainerCreationDescription': return 'containerCreation';
      case 'EdgeCreationDescription': return 'edgeCreation';
      case 'DeleteElementDescription': return 'delete';
      case 'DirectEditLabel': return 'directEdit';
      default: return siriusType || 'nodeCreation';
    }
  }

  private flattenXmiInstance(instance: any): any {
    const obj: any = {
      id: `obj_${Math.random().toString(36).slice(2, 10)}`,
      eClass: instance.eClass,
      attributes: { ...instance.attributes },
      references: {},
    };

    // Flatten children into references
    for (const [refName, children] of Object.entries(instance.children || {})) {
      obj.references[refName] = (children as any[]).map(
        child => this.flattenXmiInstance(child).id
      );
    }

    return obj;
  }
}
