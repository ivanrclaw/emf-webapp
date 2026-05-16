/**
 * @emf-webapp/backend — XmiService
 *
 * Servicio que convierte serializable EPackage a XMI 2.0
 * compatible con Eclipse EMF (.ecore files).
 *
 * Flujo:
 *   DB (SerializableEPackage JSON)
 *     + OCL constraints
 *     → OCLAnnotationExporter → annotations
 *     → serializableToXmiCompatible ()
 *        serializeToXMI () → String XMI 2.0 XML
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { Project } from '../project/project.entity.js';
import { OCLConstraint } from '../oclconstraint/oclconstraint.entity.js';

// Core serialization
import {
  serializableToXmiCompatible,
  serializeToXMI,
  parseEcoreXmi,
  OCLAnnotationExporter,
  importXmiInstance,
  exportXmiInstance,
} from '@emf-webapp/core/serialization';
import type { EAnnotationData, OCLConstraintInfo, XmiInstanceDocument } from '@emf-webapp/core/serialization';

@Injectable()
export class XmiService {
  private readonly logger = new Logger(XmiService.name);
  private readonly oclExporter = new OCLAnnotationExporter();

  constructor(
    @InjectRepository(Metamodel)
    private metamodelRepo: Repository<Metamodel>,
    @InjectRepository(OCLConstraint)
    private oclConstraintRepo: Repository<OCLConstraint>,
  ) {}

  /**
   * Exporta un metamodelo a formato XMI 2.0 (.ecore),
   * incluyendo anotaciones OCL si existen.
   * @returns string XML compatible con Eclipse EMF
   */
  async exportToXmi(projectId: string, metamodelId: string): Promise<string | null> {
    const mm = await this.metamodelRepo.findOne({
      where: { id: metamodelId, project_id: projectId } as any,
    });

    if (!mm) {
      this.logger.warn(`Metamodel not found: ${metamodelId}`);
      return null;
    }

    const content = mm.content as any;
    if (!content || !content.name) {
      this.logger.warn(`Metamodel ${metamodelId} has no valid content`);
      return null;
    }

    const serializable: any = {
      name: content.name || 'model',
      nsURI: content.nsURI || (mm as any).nsUri || '',
      nsPrefix: content.nsPrefix || (mm as any).nsPrefix || 'model',
      eClassifiers: Array.isArray(content.eClassifiers) ? content.eClassifiers : [],
    };

    // ── Integrar OCL constraints como EAnnotations ──
    try {
      const oclConstraints = await this.oclConstraintRepo.find({
        where: { metamodel_id: metamodelId } as any,
      });

      if (oclConstraints.length > 0) {
        // Convertir a OCLConstraintInfo
        const constraintInfos: OCLConstraintInfo[] = oclConstraints
          .filter(c => c.context && c.expression)
          .map(c => ({
            name: c.name,
            context: c.context,
            expression: c.expression,
            type: 'invariant' as const,
          }));

        if (constraintInfos.length > 0) {
          // Package-level annotations (delegates)
          serializable.annotations = this.oclExporter.exportPackageAnnotations(constraintInfos);

          // Class-level annotations (constraints + OCL expressions)
          for (const classifier of serializable.eClassifiers) {
            if (!('eAttributes' in classifier)) continue; // solo EClass
            const cls = classifier as any;
            const clsConstraints = constraintInfos.filter(c => c.context === cls.name);
            if (clsConstraints.length > 0) {
              cls.annotations = this.oclExporter.exportClassAnnotations(cls.name, clsConstraints);
            }

            // Operation-level annotations (OCL body expressions)
            if (cls.eOperations && Array.isArray(cls.eOperations)) {
              for (const op of cls.eOperations) {
                // Find OCL body constraints for this operation (type: 'body')
                const bodyConstraints = oclConstraints.filter(
                  c => c.context === cls.name && c.name === op.name + '_body'
                );
                if (bodyConstraints.length > 0) {
                  op.annotations = op.annotations || [];
                  op.annotations.push(
                    this.oclExporter.exportOperationAnnotation(bodyConstraints[0].expression)
                  );
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not integrate OCL annotations: ${err.message}`);
      // Non-blocking — export even without OCL annotations
    }

    // Convert to XMI-compatible object tree
    const ePackage = serializableToXmiCompatible(serializable);

    // Serialize to XMI 2.0
    const xmi = serializeToXMI(ePackage, {
      nsURI: serializable.nsURI,
      nsPrefix: serializable.nsPrefix,
    });

    return xmi;
  }

  /**
   * Genera el archivo .genmodel correspondiente al metamodelo.
   */
  async exportGenmodel(projectId: string, metamodelId: string): Promise<string | null> {
    const mm = await this.metamodelRepo.findOne({
      where: { id: metamodelId, project_id: projectId } as any,
    });

    if (!mm) return null;

    const content = mm.content as any;
    const pkgName = content?.name || (mm as any).name || 'model';
    const nsURI = content?.nsURI || (mm as any).nsUri || '';
    const nsPrefix = content?.nsPrefix || (mm as any).nsPrefix || 'model';

    return `<?xml version="1.0" encoding="UTF-8"?>
<genmodel:GenModel xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    xmlns:genmodel="http://www.eclipse.org/emf/2002/GenModel"
    copyrightText=""
    modelDirectory="/${pkgName}/src"
    editDirectory="/${pkgName}.edit/src"
    editorDirectory="/${pkgName}.editor/src"
    testsDirectory="/${pkgName}.tests/src"
    modelPluginID="${pkgName}"
    forceOverwrite="false"
    updateClasspath="false">
  <genPackages ecorePackage="${nsURI}#/">
    <genClasses ecoreClass="${nsURI}#//${pkgName}"/>
  </genPackages>
</genmodel:GenModel>`;
  }

  /**
   * Importa un archivo .ecore (XMI 2.0) y actualiza el contenido del metamodelo.
   */
  async importFromXmi(projectId: string, metamodelId: string, xml: string): Promise<boolean> {
    try {
      const parsed = parseEcoreXmi(xml);
      const mm = await this.metamodelRepo.findOne({
        where: { id: metamodelId, project_id: projectId } as any,
      });
      if (!mm) return false;

      (mm as any).content = parsed;
      await this.metamodelRepo.save(mm as any);
      this.logger.log(`Metamodel ${metamodelId} imported successfully`);
      return true;
    } catch (err: any) {
      this.logger.error(`Import failed for ${metamodelId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Importa una instancia .xmi (M1) conforme a un metamodelo.
   */
  async importInstance(
    projectId: string,
    metamodelId: string,
    xml: string,
  ): Promise<{ document: XmiInstanceDocument | null; error?: string }> {
    try {
      const mm = await this.metamodelRepo.findOne({
        where: { id: metamodelId, project_id: projectId } as any,
      });
      if (!mm) return { document: null, error: 'Metamodel not found' };

      const content = mm.content as any;
      if (!content || !content.name) {
        return { document: null, error: 'Metamodel has no valid content' };
      }

      const document = importXmiInstance(xml, content);
      return { document };
    } catch (err: any) {
      this.logger.error(`Instance import failed: ${err.message}`);
      return { document: null, error: err.message };
    }
  }

  /**
   * Exporta una instancia .xmi (M1) conforme a un metamodelo.
   */
  async exportInstance(
    projectId: string,
    metamodelId: string,
    document: XmiInstanceDocument,
  ): Promise<string | null> {
    try {
      const mm = await this.metamodelRepo.findOne({
        where: { id: metamodelId, project_id: projectId } as any,
      });
      if (!mm) return null;

      const content = mm.content as any;
      if (!content || !content.name) return null;

      return exportXmiInstance(document as any, content);
    } catch (err: any) {
      this.logger.error(`Instance export failed: ${err.message}`);
      return null;
    }
  }
}
