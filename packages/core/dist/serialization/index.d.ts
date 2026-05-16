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
//# sourceMappingURL=index.d.ts.map