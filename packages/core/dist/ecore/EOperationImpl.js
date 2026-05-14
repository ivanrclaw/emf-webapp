/**
 * @emf-webapp/core — EOperationImpl + EParameterImpl
 *
 * Implementación de EOperation con eParameters, eExceptions (derived),
 * eGenericExceptions, getOperationID, isOverrideOf.
 * Implementación de EParameter con eOperation (container).
 */
import { ETypedElementImpl } from './ETypedElementImpl.js';
import { EListImpl } from '../util/EList.js';
// ============================================================
// EParameterImpl
// ============================================================
export class EParameterImpl extends ETypedElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _eOperation = null;
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    /** Container */
    get eOperation() {
        if (this._eOperation === null) {
            throw new Error('EParameter is not contained in an EOperation');
        }
        return this._eOperation;
    }
    set eOperation(value) {
        this._eOperation = value;
    }
}
// ============================================================
// EOperationImpl
// ============================================================
export class EOperationImpl extends ETypedElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _eContainingClass = null;
    /** Parámetros (containment) */
    _eParameters = new EListImpl({
        unique: true,
        notifier: this,
    });
    /** Excepciones genéricas (containment) */
    _eGenericExceptions = new EListImpl({
        unique: false,
        notifier: this,
    });
    /** Type parameters (containment) */
    _eTypeParameters = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    /** Container */
    get eContainingClass() {
        if (this._eContainingClass === null) {
            throw new Error('EOperation is not contained in an EClass');
        }
        return this._eContainingClass;
    }
    set eContainingClass(value) {
        this._eContainingClass = value;
    }
    get eParameters() {
        return this._eParameters;
    }
    set eParameters(value) {
        this._eParameters.clear();
        for (const p of value) {
            this._eParameters.add(p);
        }
    }
    /**
     * DERIVED — excepciones obtenidas desde eGenericExceptions (erasure).
     */
    get eExceptions() {
        const result = [];
        for (const gt of this._eGenericExceptions) {
            const raw = gt.eRawType ?? gt.eClassifier;
            if (raw) {
                result.push(raw);
            }
        }
        return result;
    }
    get eGenericExceptions() {
        return this._eGenericExceptions;
    }
    set eGenericExceptions(value) {
        this._eGenericExceptions.clear();
        for (const gt of value) {
            this._eGenericExceptions.add(gt);
        }
    }
    /**
     * Type parameters de la operación (genéricos de método).
     */
    get eTypeParameters() {
        return this._eTypeParameters;
    }
    set eTypeParameters(value) {
        this._eTypeParameters.clear();
        for (const tp of value) {
            this._eTypeParameters.add(tp);
        }
    }
    // ==========================================================
    // Métodos
    // ==========================================================
    /**
     * Retorna el operationID dentro de la clase contenedora.
     */
    getOperationID() {
        if (this._eContainingClass === null) {
            return -1;
        }
        return this._eContainingClass.getOperationID(this);
    }
    /**
     * Verifica si esta operación hace override de otra.
     * Dos operaciones están en override si:
     * - Tienen el mismo nombre
     * - La otra pertenece a un super tipo
     */
    isOverrideOf(someOperation) {
        if (this._name !== someOperation.name) {
            return false;
        }
        if (this._eContainingClass === null) {
            return false;
        }
        const otherClass = someOperation.eContainingClass;
        if (otherClass === null) {
            return false;
        }
        // Verificar si otherClass es super tipo de nuestra clase
        return this._eContainingClass.eAllSuperTypes.includes(otherClass);
    }
}
//# sourceMappingURL=EOperationImpl.js.map