/**
 * @emf-webapp/core — serialization barrel export
 */
export { serializeToXMI, deserializeFromXMI, getDefaultEcoreRegistry } from './XMISerializer.js';
export { SerializableToEcoreConverter } from './SerializableToEcoreConverter.js';
export { parseEcoreXmi } from './EcoreXmiParser.js';
export { serializableToXmiCompatible } from './SerializableToXmiObject.js';
export { OCLAnnotationExporter } from './OCLAnnotationExporter.js';
export { importXmiInstance, exportXmiInstance, generateFragmentPath, resolveFragmentPath, } from './XmiInstanceImporter.js';
export { generateGenmodel } from './GenmodelGenerator.js';
export { generateCompleteOCL, generateInlineOCLAnnotations, generateOCLDelegationAnnotations, } from './CompleteOCLExporter.js';
export { generateEclipseProjectFiles } from './EclipseProjectGenerator.js';
export { generateOdesign } from './SiriusOdesignGenerator.js';
export { generateAird } from './SiriusAirdGenerator.js';
export { generateEuGENiaAnnotations, viewpointSpecToEuGENia, serializeEuGENiaAnnotationXml, } from './EuGENiaAnnotationGenerator.js';
export { generateAcceleoModule, generateAcceleoSingleTemplate } from './AcceleoMtlGenerator.js';
//# sourceMappingURL=index.js.map