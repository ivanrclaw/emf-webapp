/**
 * @emf-webapp/core — SerializableToXmiObject
 *
 * Convierte SerializableEPackage a un objeto compatible con
 * serializeToXMI() del XMISerializer.
 *
 * En lugar de usar las clases Impl (que requieren _initStaticClass),
 * crea objetos planos con método eClass() que devuelve la EClass
 * apropiada, mismo patrón que usa deserializeFromXMI internamente.
 */
import type { SerializableEPackage } from './SerializableToEcoreConverter.js';
export declare function serializableToXmiCompatible(serializable: SerializableEPackage): any;
//# sourceMappingURL=SerializableToXmiObject.d.ts.map