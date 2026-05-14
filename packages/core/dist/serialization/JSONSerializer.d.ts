/**
 * @emf-webapp/core — JSONSerializer
 *
 * Serialización/deserialización de EObject/EPackage a JSON compatible con emfjson.
 *
 * Formato emfjson:
 * - eClass: URI fragment (e.g. "http://www.eclipse.org/emf/2002/Ecore#//EClass")
 * - EAttribute: valores JSON primitivos (string, number, boolean, null)
 * - EReference containment=true: objetos anidados (recursivo)
 * - EReference containment=false: arrays de strings (URI fragment paths)
 * - EList: serializado como array JSON
 */
import type { EObject, EPackage, PackageRegistry } from '../ecore/interfaces.js';
/**
 * Serializa un EObject a JSON compatible con emfjson.
 *
 * @param obj - El EObject a serializar
 * @param options - Opciones de serialización
 * @param options.pretty - Si se debe formatear el JSON con indentación (default: false)
 * @param options.rootPackage - EPackage raíz para resolver referencias (opcional)
 * @returns String JSON
 */
export declare function serializeEObject(obj: EObject, options?: {
    pretty?: boolean;
    rootPackage?: EPackage;
}): string;
/**
 * Deserializa un EObject desde JSON.
 *
 * @param json - String JSON o objeto JavaScript
 * @param registry - PackageRegistry para resolver paquetes por nsURI
 * @returns El EObject deserializado
 */
export declare function deserializeEObject(json: string | object, registry?: PackageRegistry): EObject;
/**
 * Serializa un EPackage completo a JSON compatible con emfjson.
 *
 * @param pkg - El EPackage a serializar
 * @returns String JSON del paquete completo
 */
export declare function serializeEPackage(pkg: EPackage): string;
//# sourceMappingURL=JSONSerializer.d.ts.map