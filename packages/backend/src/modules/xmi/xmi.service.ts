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
// eslint-disable-next-line @typescript-eslint/no-require-imports
import AdmZip = require('adm-zip');
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
    if (!content) {
      this.logger.warn(`Metamodel ${metamodelId} has no content`);
      return null;
    }

    const serializable: any = {
      name: content.name || mm.name || 'model',
      nsURI: content.nsURI || (mm as any).ns_uri || '',
      nsPrefix: content.nsPrefix || (mm as any).ns_prefix || 'model',
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
    let ePackage: any;
    try {
      ePackage = serializableToXmiCompatible(serializable);
    } catch (err: any) {
      this.logger.error(`Failed to convert serializable to XMI-compatible: ${err.message}`);
      throw new Error(`Failed to convert serializable to XMI-compatible: ${err.message}`);
    }

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

    // Generate genClasses for ALL EClasses in the metamodel
    const classifiers = content?.eClassifiers || [];
    const genClassLines = classifiers
      .filter((c: any) => c.eAttributes || c.eReferences) // EClass (not EEnum/EDataType)
      .map((c: any) => `    <genClasses ecoreClass="${nsURI}#//${c.name}"/>`)
      .join('\n');

    // Generate genEnums for all EEnums
    const genEnumLines = classifiers
      .filter((c: any) => c.eLiterals)
      .map((c: any) => `    <genEnums ecoreEnum="${nsURI}#//${c.name}"/>`)
      .join('\n');

    const nestedContent = [genClassLines, genEnumLines].filter(l => l).join('\n');

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
  <genPackages prefix="${nsPrefix.charAt(0).toUpperCase() + nsPrefix.slice(1)}" disposableProviderFactory="true" ecorePackage="${pkgName}.ecore#/">
${nestedContent}
  </genPackages>
</genmodel:GenModel>`;
  }

  /**
   * Exporta un proyecto Eclipse completo como ZIP importable.
   * Genera la estructura estándar de un EMF plugin project.
   */
  async exportEclipseProject(projectId: string, metamodelId: string): Promise<Buffer | null> {
    const mm = await this.metamodelRepo.findOne({
      where: { id: metamodelId, project_id: projectId } as any,
    });

    if (!mm) return null;

    const content = mm.content as any;
    if (!content) return null;

    const pkgName = content.name || mm.name || 'model';
    const nsURI = content.nsURI || '';
    const nsPrefix = content.nsPrefix || pkgName.toLowerCase();
    const pluginId = `org.eclipse.emf.${nsPrefix}`;

    // Generate .ecore and .genmodel
    const [ecoreXml, genmodelXml] = await Promise.all([
      this.exportToXmi(projectId, metamodelId),
      this.exportGenmodel(projectId, metamodelId),
    ]);

    if (!ecoreXml) return null;

    const zip = new AdmZip();

    const root = `${pluginId}/`;

    // .project — Eclipse project descriptor
    const dotProject = `<?xml version="1.0" encoding="UTF-8"?>
<projectDescription>
  <name>${pluginId}</name>
  <comment>Generated by EMF WebApp</comment>
  <projects>
  </projects>
  <buildSpec>
    <buildCommand>
      <name>org.eclipse.jdt.core.javabuilder</name>
      <arguments>
      </arguments>
    </buildCommand>
    <buildCommand>
      <name>org.eclipse.pde.ManifestBuilder</name>
      <arguments>
      </arguments>
    </buildCommand>
    <buildCommand>
      <name>org.eclipse.pde.SchemaBuilder</name>
      <arguments>
      </arguments>
    </buildCommand>
  </buildSpec>
  <natures>
    <nature>org.eclipse.pde.PluginNature</nature>
    <nature>org.eclipse.jdt.core.javanature</nature>
    <nature>org.eclipse.emf.ecore.EcoreNature</nature>
  </natures>
</projectDescription>`;

    // .classpath
    const dotClasspath = `<?xml version="1.0" encoding="UTF-8"?>
<classpath>
  <classpathentry kind="src" path="src"/>
  <classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER"/>
  <classpathentry kind="con" path="org.eclipse.pde.core.requiredPlugins"/>
  <classpathentry kind="output" path="bin"/>
</classpath>`;

    // META-INF/MANIFEST.MF
    const manifest = `Manifest-Version: 1.0
Bundle-ManifestVersion: 2
Bundle-Name: ${pkgName}
Bundle-SymbolicName: ${pluginId};singleton:=true
Bundle-Version: 1.0.0.qualifier
Bundle-ClassPath: .
Bundle-Vendor: EMF WebApp
Bundle-Localization: plugin
Bundle-RequiredExecutionEnvironment: JavaSE-17
Export-Package: ${nsPrefix}
Require-Bundle: org.eclipse.core.runtime,
 org.eclipse.emf.ecore;visibility:=reexport,
 org.eclipse.emf.ecore.xmi;visibility:=reexport
Bundle-ActivationPolicy: lazy
`;

    // build.properties
    const buildProperties = `source.. = src/
output.. = bin/
bin.includes = META-INF/,\\
               .,\\
               plugin.xml,\\
               model/
`;

    // plugin.xml
    const pluginXml = `<?xml version="1.0" encoding="UTF-8"?>
<?eclipse version="3.0"?>
<plugin>
  <extension point="org.eclipse.emf.ecore.generated_package">
    <package
      uri="${nsURI}"
      class="${nsPrefix}.${pkgName.charAt(0).toUpperCase() + pkgName.slice(1)}Package"
      genModel="model/${pkgName}.genmodel"/>
  </extension>
</plugin>`;

    // Add all files to ZIP
    zip.addFile(`${root}.project`, Buffer.from(dotProject, 'utf-8'));
    zip.addFile(`${root}.classpath`, Buffer.from(dotClasspath, 'utf-8'));
    zip.addFile(`${root}META-INF/MANIFEST.MF`, Buffer.from(manifest, 'utf-8'));
    zip.addFile(`${root}build.properties`, Buffer.from(buildProperties, 'utf-8'));
    zip.addFile(`${root}plugin.xml`, Buffer.from(pluginXml, 'utf-8'));
    zip.addFile(`${root}model/${pkgName}.ecore`, Buffer.from(ecoreXml, 'utf-8'));
    if (genmodelXml) {
      zip.addFile(`${root}model/${pkgName}.genmodel`, Buffer.from(genmodelXml, 'utf-8'));
    }

    // Create empty src/ directory placeholder
    zip.addFile(`${root}src/.gitkeep`, Buffer.from(''));

    return zip.toBuffer();
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
