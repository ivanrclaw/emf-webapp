/**
 * @emf-webapp/core — serialization barrel export
 */
export { serializeToXMI, deserializeFromXMI, getDefaultEcoreRegistry } from './XMISerializer.js';
export { SerializableToEcoreConverter } from './SerializableToEcoreConverter.js';
export { parseEcoreXmi } from './EcoreXmiParser.js';
export { serializableToXmiCompatible } from './SerializableToXmiObject.js';
export { OCLAnnotationExporter } from './OCLAnnotationExporter.js';
export type { OCLConstraintInfo, EAnnotationData, } from './OCLAnnotationExporter.js';
export type { SerializableEPackage, SerializableEClass, SerializableEEnum, SerializableEDataType, SerializableEAttribute, SerializableEReference, SerializableEEnumLiteral, SerializableAnnotation, } from './SerializableToEcoreConverter.js';
export { importXmiInstance, exportXmiInstance, generateFragmentPath, resolveFragmentPath, } from './XmiInstanceImporter.js';
export type { XmiInstance, XmiInstanceRef, XmiInstanceDocument, } from './XmiInstanceImporter.js';
export { generateGenmodel } from './GenmodelGenerator.js';
export type { GenmodelOptions } from './GenmodelGenerator.js';
export { generateCompleteOCL, generateInlineOCLAnnotations, generateOCLDelegationAnnotations, } from './CompleteOCLExporter.js';
export type { OCLConstraintInput, CompleteOCLOptions, InlineOCLAnnotation, PackageOCLDelegation, } from './CompleteOCLExporter.js';
export { generateEclipseProjectFiles } from './EclipseProjectGenerator.js';
export type { EclipseProjectOptions, EclipseProjectFiles } from './EclipseProjectGenerator.js';
export { generateOdesign } from './SiriusOdesignGenerator.js';
export type { OdesignViewpointSpec, OdesignOptions, OdesignLayer, OdesignNodeMapping, OdesignContainerMapping, OdesignEdgeMapping, OdesignToolSection, OdesignTool, } from './SiriusOdesignGenerator.js';
export { generateAird } from './SiriusAirdGenerator.js';
export type { AirdOptions } from './SiriusAirdGenerator.js';
export { generateEuGENiaAnnotations, viewpointSpecToEuGENia, serializeEuGENiaAnnotationXml, } from './EuGENiaAnnotationGenerator.js';
export type { EuGENiaAnnotation, EuGENiaNodeConfig, EuGENiaLinkConfig, EuGENiaCompartmentConfig, EuGENiaDiagramConfig, EuGENiaSpec, } from './EuGENiaAnnotationGenerator.js';
export { generateAcceleoModule, generateAcceleoSingleTemplate } from './AcceleoMtlGenerator.js';
export type { CodeTemplateInput, AcceleoModuleOptions } from './AcceleoMtlGenerator.js';
//# sourceMappingURL=index.d.ts.map