/**
 * @emf-webapp/core — EOperationImpl + EParameterImpl
 *
 * Implementación de EOperation con eParameters, eExceptions (derived),
 * eGenericExceptions, getOperationID, isOverrideOf.
 * Implementación de EParameter con eOperation (container).
 */
import { ETypedElementImpl } from './ETypedElementImpl.js';
import type { EOperation, EParameter, EClass, EClassifier, EGenericType, ETypeParameter, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare class EParameterImpl extends ETypedElementImpl implements EParameter {
    protected _eOperation: EOperation | null;
    /** Container */
    get eOperation(): EOperation;
    set eOperation(value: EOperation);
}
export declare class EOperationImpl extends ETypedElementImpl implements EOperation {
    protected _eContainingClass: EClass | null;
    /** Parámetros (containment) */
    protected _eParameters: EListImpl<EParameter>;
    /** Excepciones genéricas (containment) */
    protected _eGenericExceptions: EListImpl<EGenericType>;
    /** Type parameters (containment) */
    protected _eTypeParameters: EListImpl<ETypeParameter>;
    /** Container */
    get eContainingClass(): EClass;
    set eContainingClass(value: EClass);
    get eParameters(): EList<EParameter>;
    set eParameters(value: EList<EParameter>);
    /**
     * DERIVED — excepciones obtenidas desde eGenericExceptions (erasure).
     */
    get eExceptions(): EClassifier[];
    get eGenericExceptions(): EGenericType[];
    set eGenericExceptions(value: EGenericType[]);
    /**
     * Type parameters de la operación (genéricos de método).
     */
    get eTypeParameters(): ETypeParameter[];
    set eTypeParameters(value: ETypeParameter[]);
    /**
     * Retorna el operationID dentro de la clase contenedora.
     */
    getOperationID(): number;
    /**
     * Verifica si esta operación hace override de otra.
     * Dos operaciones están en override si:
     * - Tienen el mismo nombre
     * - La otra pertenece a un super tipo
     */
    isOverrideOf(someOperation: EOperation): boolean;
}
//# sourceMappingURL=EOperationImpl.d.ts.map