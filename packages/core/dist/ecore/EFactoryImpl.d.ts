/**
 * @emf-webapp/core — EFactoryImpl
 *
 * Implementación de EFactory con create(EClass), createFromString(EDataType, String),
 * convertToString(EDataType, Object).
 */
import { EModelElementImpl } from './EModelElementImpl.js';
import type { EFactory, EPackage, EClass, EDataType, EObject } from './interfaces.js';
export declare class EFactoryImpl extends EModelElementImpl implements EFactory {
    protected _ePackage: EPackage | null;
    /** DERIVED, transient */
    get ePackage(): EPackage;
    set ePackage(value: EPackage);
    /**
     * Crea una nueva instancia de la EClass dada.
     * Usa eInvoke si la clase tiene un factory method, o intenta
     * instanciar dinámicamente.
     */
    create(eClass: EClass): EObject;
    /**
     * Convierte un string literal a un valor del tipo EDataType.
     */
    createFromString(eDataType: EDataType, literalValue: string): any;
    /**
     * Convierte un valor de instancia a su representación string.
     */
    convertToString(eDataType: EDataType, instanceValue: any): string;
}
//# sourceMappingURL=EFactoryImpl.d.ts.map