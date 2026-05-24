/**
 * @emf-webapp/backend — ProjectExportService
 *
 * Exports a project as either:
 *   1. Internal JSON format (for backup/reimport into emf-webapp)
 *   2. Eclipse-compatible project bundle (importable into Eclipse IDE)
 *
 * Eclipse bundle structure:
 *   com.example.project/
 *   ├── .project
 *   ├── .classpath
 *   ├── META-INF/MANIFEST.MF
 *   ├── plugin.xml
 *   ├── build.properties
 *   ├── model/
 *   │   ├── metamodel.ecore
 *   │   ├── metamodel.genmodel
 *   │   ├── metamodel.emf (Emfatic)
 *   │   └── constraints.ocl
 *   ├── description/
 *   │   └── metamodel.odesign
 *   ├── instances/
 *   │   ├── example.xmi
 *   │   └── representations.aird
 *   └── templates/
 *       └── generate.mtl
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
import { EcoreTransformer } from '../../common/ecore-transformer.js';
import {
  generateGenmodel,
  generateCompleteOCL,
  generateInlineOCLAnnotations,
  generateOCLDelegationAnnotations,
  generateEclipseProjectFiles,
  generateOdesign,
  generateAird,
  generateAcceleoModule,
  exportXmiInstance,
  serializeToEmfatic,
  type SerializableEPackage,
  type OCLConstraintInput,
  type OdesignViewpointSpec,
  type OdesignNodeMapping,
  type OdesignContainerMapping,
  type OdesignEdgeMapping,
  type OdesignToolSection,
  type CodeTemplateInput,
} from '@emf-webapp/core/serialization';

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
    private readonly ecoreTransformer: EcoreTransformer,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // Internal JSON export (backward compatible)
  // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════
  // Eclipse-compatible export
  // ═══════════════════════════════════════════════════════════════

  async exportProjectAsEclipse(projectId: string): Promise<Buffer> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with id "${projectId}" not found`);
    }

    const zip = new AdmZip();
    const metamodels = await this.metamodelRepo.find({ where: { project_id: projectId } });

    for (const mm of metamodels) {
      await this.exportMetamodelAsEclipseProject(zip, mm, project);
    }

    return zip.toBuffer();
  }

  private async exportMetamodelAsEclipseProject(
    zip: AdmZip,
    mm: Metamodel,
    project: Project,
  ): Promise<void> {
    const content = mm.content as any;
    const pkgName = content?.name || mm.name || 'model';
    const nsURI = content?.nsURI || mm.ns_uri || `http://www.example.org/${pkgName}`;
    const nsPrefix = content?.nsPrefix || mm.ns_prefix || pkgName.toLowerCase();
    const pluginId = `org.example.${nsPrefix}`;
    const projectDir = `${pluginId}/`;

    // Load related entities
    const constraints = await this.constraintRepo.find({ where: { metamodel_id: mm.id } });
    const specs = await this.specRepo.find({ where: { metamodel_id: mm.id } });
    const models = await this.modelRepo.find({ where: { metamodel_id: mm.id } });
    const templates = await this.templateRepo.find({ where: { metamodel_id: mm.id } });

    const hasOCL = constraints.length > 0;
    const hasSirius = specs.length > 0;
    const hasAcceleo = templates.length > 0;

    // ─── 1. Eclipse project metadata ───────────────────────────
    const eclipseFiles = generateEclipseProjectFiles({
      pluginId,
      projectName: project.name || pkgName,
      packageName: pkgName,
      nsURI,
      nsPrefix,
      hasSirius,
      hasOCL,
      hasAcceleo,
      javaVersion: '17',
    });

    zip.addFile(`${projectDir}.project`, Buffer.from(eclipseFiles['.project']));
    zip.addFile(`${projectDir}.classpath`, Buffer.from(eclipseFiles['.classpath']));
    zip.addFile(`${projectDir}META-INF/MANIFEST.MF`, Buffer.from(eclipseFiles['META-INF/MANIFEST.MF']));
    zip.addFile(`${projectDir}plugin.xml`, Buffer.from(eclipseFiles['plugin.xml']));
    zip.addFile(`${projectDir}build.properties`, Buffer.from(eclipseFiles['build.properties']));

    // ─── 2. .ecore metamodel (XMI) ────────────────────────────
    const ecoreFileName = `${pkgName}.ecore`;
    const ecoreFilePath = `model/${ecoreFileName}`;
    const ecoreXmi = this.ecoreTransformer.export(content, nsURI, nsPrefix, 'xmi');
    zip.addFile(`${projectDir}${ecoreFilePath}`, Buffer.from(ecoreXmi));

    // Build serializable representation (used by multiple generators)
    const serializable = this.contentToSerializable(content, nsURI, nsPrefix, pkgName);

    // ─── 2b. .emf (Emfatic textual format) ────────────────────
    try {
      const emfaticContent = serializeToEmfatic(serializable);
      zip.addFile(`${projectDir}model/${pkgName}.emf`, Buffer.from(emfaticContent));
    } catch {
      // Emfatic serialization is best-effort
    }

    // ─── 3. .genmodel ─────────────────────────────────────────
    const genmodelFileName = `${pkgName}.genmodel`;
    const genmodelFilePath = `model/${genmodelFileName}`;
    const genmodel = generateGenmodel(serializable, {
      ecoreFilePath: ecoreFileName,
      basePackage: `org.example`,
      modelPluginID: pluginId,
    });
    zip.addFile(`${projectDir}${genmodelFilePath}`, Buffer.from(genmodel));

    // ─── 4. Complete OCL (.ocl) ───────────────────────────────
    if (hasOCL) {
      const oclInputs: OCLConstraintInput[] = constraints.map(c => ({
        name: c.name,
        context: c.context,
        expression: c.expression,
        severity: c.severity,
      }));

      const oclContent = generateCompleteOCL(oclInputs, {
        packageName: pkgName,
        nsURI,
        headerComment: `OCL constraints for ${pkgName}\nGenerated by emf-webapp`,
      });
      zip.addFile(`${projectDir}model/${pkgName}.ocl`, Buffer.from(oclContent));
    }

    // ─── 5. Sirius .odesign ───────────────────────────────────
    if (hasSirius) {
      for (const spec of specs) {
        const specData = typeof spec.spec === 'string' ? JSON.parse(spec.spec) : spec.spec;
        const odesignContent = this.convertSpecToOdesign(specData, {
          pluginId,
          packageName: pkgName,
          nsURI,
        });
        const odesignFileName = `${spec.name || pkgName}.odesign`;
        zip.addFile(`${projectDir}description/${odesignFileName}`, Buffer.from(odesignContent));
      }
    }

    // ─── 6. M1 Model instances (.xmi) ────────────────────────
    if (models.length > 0) {
      for (const model of models) {
        const modelContent = typeof model.content === 'string'
          ? JSON.parse(model.content)
          : model.content;

        if (modelContent && Array.isArray(modelContent) && modelContent.length > 0) {
          const xmiContent = this.convertM1ToXmi(modelContent, serializable, nsURI, nsPrefix);
          zip.addFile(`${projectDir}instances/${model.name}.xmi`, Buffer.from(xmiContent));
        }
      }

      // .aird for Sirius representations
      if (hasSirius && specs.length > 0) {
        const specData = typeof specs[0].spec === 'string' ? JSON.parse(specs[0].spec) : specs[0].spec;
        const viewpointName = specData?.name || 'Design';
        const diagramName = specData?.diagram?.label || 'Main Diagram';

        const airdContent = generateAird({
          odesignPath: `description/${specs[0].name || pkgName}.odesign`,
          semanticModelPath: models.length > 0 ? `instances/${models[0].name}.xmi` : '',
          ecorePath: ecoreFilePath,
          viewpointName,
          diagramName,
          representationName: `${diagramName} - ${models[0]?.name || 'instance'}`,
        });
        zip.addFile(`${projectDir}instances/representations.aird`, Buffer.from(airdContent));
      }
    }

    // ─── 7. Acceleo templates (.mtl) ─────────────────────────
    if (hasAcceleo) {
      const acceleoInputs: CodeTemplateInput[] = templates.map((t, i) => ({
        name: t.name || `template${i}`,
        context: (t as any).context || 'EClass',
        body: (t as any).body || (t as any).content || '',
        outputFile: (t as any).outputFile,
        isMain: i === 0,
        visibility: 'public' as const,
        description: (t as any).description,
      }));

      const mtlContent = generateAcceleoModule(acceleoInputs, {
        moduleName: 'generate',
        nsURI,
        description: `Code generation templates for ${pkgName}`,
      });
      zip.addFile(`${projectDir}templates/generate.mtl`, Buffer.from(mtlContent));
    }

    // ─── 8. src/ placeholder ──────────────────────────────────
    zip.addFile(`${projectDir}src/.gitkeep`, Buffer.from(''));
    zip.addFile(`${projectDir}src-gen/.gitkeep`, Buffer.from(''));
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  private contentToSerializable(
    content: any,
    nsURI: string,
    nsPrefix: string,
    pkgName: string,
  ): SerializableEPackage {
    return {
      name: content?.name || pkgName,
      nsURI: content?.nsURI || nsURI,
      nsPrefix: content?.nsPrefix || nsPrefix,
      eClassifiers: Array.isArray(content?.eClassifiers) ? content.eClassifiers : [],
      annotations: content?.annotations,
    } as SerializableEPackage;
  }

  private convertSpecToOdesign(
    specData: any,
    options: { pluginId: string; packageName: string; nsURI: string },
  ): string {
    // Convert webapp ViewpointSpec JSON to OdesignViewpointSpec
    const defaultLayer = specData?.defaultLayer || { nodeMappings: [], containerMappings: [], edgeMappings: [], toolSections: [] };

    const odesignSpec: OdesignViewpointSpec = {
      id: specData?.id || 'vsp_default',
      name: specData?.name || 'Design',
      metamodelNsURI: options.nsURI,
      diagram: {
        id: specData?.diagram?.id || 'diag_main',
        label: specData?.diagram?.label || 'Main Diagram',
        domainClass: specData?.diagram?.domainClass || options.packageName,
        titleExpression: specData?.diagram?.titleExpression,
      },
      defaultLayer: {
        id: defaultLayer.id || 'layer_default',
        name: defaultLayer.name || 'Default',
        isDefault: true,
        activeByDefault: true,
        nodeMappings: (defaultLayer.nodeMappings || []).map((nm: any) => this.convertNodeMapping(nm)),
        containerMappings: (defaultLayer.containerMappings || []).map((cm: any) => this.convertContainerMapping(cm)),
        edgeMappings: (defaultLayer.edgeMappings || []).map((em: any) => this.convertEdgeMapping(em)),
        toolSections: (defaultLayer.toolSections || []).map((ts: any) => this.convertToolSection(ts)),
      },
      additionalLayers: (specData?.additionalLayers || []).map((layer: any) => ({
        id: layer.id,
        name: layer.name,
        isDefault: false,
        activeByDefault: layer.activeByDefault ?? false,
        nodeMappings: (layer.nodeMappings || []).map((nm: any) => this.convertNodeMapping(nm)),
        containerMappings: (layer.containerMappings || []).map((cm: any) => this.convertContainerMapping(cm)),
        edgeMappings: (layer.edgeMappings || []).map((em: any) => this.convertEdgeMapping(em)),
        toolSections: (layer.toolSections || []).map((ts: any) => this.convertToolSection(ts)),
      })),
    };

    return generateOdesign(odesignSpec, options);
  }

  private convertNodeMapping(nm: any): OdesignNodeMapping {
    return {
      id: nm.id || 'node_unknown',
      domainClass: nm.domainClass || '',
      semanticCandidatesExpression: nm.semanticCandidatesExpression || '',
      preconditionExpression: nm.preconditionExpression,
      labelExpression: nm.labelExpression || nm.defaultStyle?.labelExpression || 'self.name',
      defaultStyle: {
        shape: nm.defaultStyle?.shape || 'rectangle',
        color: nm.defaultStyle?.color || '#6366f1',
        borderColor: nm.defaultStyle?.borderColor || '#818cf8',
        borderSize: nm.defaultStyle?.borderSize ?? 2,
        borderLineStyle: nm.defaultStyle?.borderLineStyle || 'solid',
        width: nm.defaultStyle?.width,
        height: nm.defaultStyle?.height,
        labelExpression: nm.defaultStyle?.labelExpression || 'self.name',
        labelColor: nm.defaultStyle?.labelColor || '#ffffff',
        labelSize: nm.defaultStyle?.labelSize ?? 13,
        labelPosition: nm.defaultStyle?.labelPosition || 'inside',
        labelBold: nm.defaultStyle?.labelBold ?? false,
        labelItalic: nm.defaultStyle?.labelItalic ?? false,
      },
    };
  }

  private convertContainerMapping(cm: any): OdesignContainerMapping {
    return {
      ...this.convertNodeMapping(cm),
      childrenPresentation: cm.childrenPresentation || 'FreeForm',
      subNodeMappingIds: cm.subNodeMappingIds || [],
      subContainerMappingIds: cm.subContainerMappingIds || [],
    };
  }

  private convertEdgeMapping(em: any): OdesignEdgeMapping {
    return {
      id: em.id || 'edge_unknown',
      type: em.type || 'relation-based',
      sourceReference: em.sourceReference,
      domainClass: em.domainClass,
      semanticCandidatesExpression: em.semanticCandidatesExpression,
      sourceMappingIds: em.sourceMappingIds || [],
      targetMappingIds: em.targetMappingIds || [],
      sourceFinderExpression: em.sourceFinderExpression,
      targetFinderExpression: em.targetFinderExpression || '',
      preconditionExpression: em.preconditionExpression,
      defaultStyle: {
        lineStyle: em.defaultStyle?.lineStyle || 'solid',
        lineWidth: em.defaultStyle?.lineWidth ?? 2,
        color: em.defaultStyle?.color || '#6366f1',
        sourceDecoration: em.defaultStyle?.sourceDecoration || 'none',
        targetDecoration: em.defaultStyle?.targetDecoration || 'arrow',
        routingStyle: em.defaultStyle?.routingStyle || 'manhattan',
        centerLabelExpression: em.defaultStyle?.centerLabelExpression,
        beginLabelExpression: em.defaultStyle?.beginLabelExpression,
        endLabelExpression: em.defaultStyle?.endLabelExpression,
        labelColor: em.defaultStyle?.labelColor || '#a1a1aa',
        labelSize: em.defaultStyle?.labelSize ?? 11,
      },
    };
  }

  private convertToolSection(ts: any): OdesignToolSection {
    return {
      id: ts.id || 'tools_default',
      label: ts.label || 'Tools',
      tools: (ts.tools || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        label: t.label,
        mappingId: t.mappingId,
        edgeMappingId: t.edgeMappingId,
        createType: t.createType,
        containmentReference: t.containmentReference,
        featureToSet: t.featureToSet,
        mappingIds: t.mappingIds,
      })),
    };
  }

  private convertM1ToXmi(
    objects: any[],
    metamodel: SerializableEPackage,
    nsURI: string,
    nsPrefix: string,
  ): string {
    // Convert flat object array to XmiInstanceDocument and export
    if (!objects || objects.length === 0) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<${nsPrefix}:Model xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:${nsPrefix}="${nsURI}"/>`;
    }

    // Build containment tree from flat objects
    const root = objects[0];
    const rootInstance = this.buildXmiInstance(root, objects);

    const document = {
      root: rootInstance,
      nsURI,
      nsPrefix,
      allInstances: [] as any[],
    };

    try {
      return exportXmiInstance(document, metamodel);
    } catch {
      // Fallback: simple flat XMI
      return this.buildFlatXmi(objects, nsURI, nsPrefix);
    }
  }

  private buildXmiInstance(obj: any, allObjects: any[]): any {
    const instance: any = {
      eClass: obj.eClass || 'EObject',
      attributes: { ...(obj.attributes || {}) },
      references: {},
      children: {},
    };

    // Process references — find contained objects
    if (obj.references) {
      for (const [refName, targetIds] of Object.entries(obj.references)) {
        const ids = targetIds as string[];
        const containedChildren = ids
          .map(id => allObjects.find(o => o.id === id))
          .filter(Boolean);

        if (containedChildren.length > 0) {
          instance.children[refName] = containedChildren.map(
            child => this.buildXmiInstance(child, allObjects)
          );
        }
      }
    }

    return instance;
  }

  private buildFlatXmi(objects: any[], nsURI: string, nsPrefix: string): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<xmi:XMI xmi:version="2.0"`);
    lines.push(`    xmlns:xmi="http://www.omg.org/XMI"`);
    lines.push(`    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
    lines.push(`    xmlns:${nsPrefix}="${nsURI}">`);

    for (const obj of objects) {
      const eClass = obj.eClass || 'EObject';
      const attrs = Object.entries(obj.attributes || {})
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}="${this.escapeXml(String(v))}"`)
        .join(' ');

      const attrStr = attrs ? ` ${attrs}` : '';
      lines.push(`  <${nsPrefix}:${eClass}${attrStr}/>`);
    }

    lines.push('</xmi:XMI>');
    return lines.join('\n');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
