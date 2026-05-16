/**
 * @emf-webapp/core — XMISerializer
 *
 * Serialización/deserialización de EObject a XMI 2.0 compatible con Eclipse.
 *
 * Formato XMI 2.0:
 * - xmlns:xmi="http://www.omg.org/XMI", xmi:version="2.0"
 * - xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" (para metadatos Ecore)
 * - xmlns:prefix="nsURI" para instancias M1
 * - eSuperTypes como inline attribute (xsi:type)
 * - eOpposite como fragment path "#//ClassName/featureName"
 * - EDataType href para primitivas estándar
 * - Fragment paths para cross-references
 */
import type { EObject, PackageRegistry } from '../ecore/interfaces.js';
/**
 * Serializa un EObject a XMI 2.0.
 *
 * @param obj - El EObject raíz a serializar
 * @param options - Opciones de serialización
 * @param options.nsURI - nsURI para el namespace del modelo (por defecto usa el del paquete)
 * @param options.nsPrefix - nsPrefix para el namespace del modelo (por defecto usa el del paquete)
 * @returns String XMI 2.0
 */
export declare function serializeToXMI(obj: EObject, options?: {
    nsURI?: string;
    nsPrefix?: string;
}): string;
/**
 * Deserializa un EObject desde XMI 2.0.
 *
 * @param xml - String XML en formato XMI 2.0
 * @param registry - PackageRegistry para resolver paquetes por nsURI
 * @returns El EObject deserializado
 */
export declare function deserializeFromXMI(xml: string, registry?: PackageRegistry): EObject;
/**
 * Creates a default PackageRegistry containing the Ecore metamodel types.
 *
 * This enables deserialization of .ecore files without an external registry.
 * Each EClass is built using createMinimalEObject so no static class setup
 * is needed — the registry is self-contained.
 *
 * @returns A PackageRegistry mapping ECORE_NS to an EPackage with
 *          EPackage, EClass, EAttribute, EReference, EEnum, EOperation,
 *          EParameter, and EAnnotation EClasses.
 */
export declare function getDefaultEcoreRegistry(): PackageRegistry;
//# sourceMappingURL=XMISerializer.d.ts.map