/**
 * @emf-webapp/core — EOperationImpl + EParameterImpl
 *
 * Implementación de EOperation con eParameters, eExceptions (derived),
 * eGenericExceptions, getOperationID, isOverrideOf.
 * Implementación de EParameter con eOperation (container).
 */
import { ETypedElementImpl } from './ETypedElementImpl.js';
import type {
  EOperation,
  EParameter,
  EClass,
  EClassifier,
  EGenericType,
  ETypeParameter,
  EList,
} from './interfaces.js';
import { EListImpl } from '../util/EList.js';

// ============================================================
// EParameterImpl
// ============================================================

export class EParameterImpl extends ETypedElementImpl implements EParameter {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _eOperation: EOperation | null = null;

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  /** Container */
  get eOperation(): EOperation {
    if (this._eOperation === null) {
      throw new Error('EParameter is not contained in an EOperation');
    }
    return this._eOperation;
  }

  set eOperation(value: EOperation) {
    this._eOperation = value;
  }
}

// ============================================================
// EOperationImpl
// ============================================================

export class EOperationImpl extends ETypedElementImpl implements EOperation {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _eContainingClass: EClass | null = null;

  /** Parámetros (containment) */
  protected _eParameters: EListImpl<EParameter> = new EListImpl<EParameter>({
    unique: true,
    notifier: this,
  });

  /** Excepciones genéricas (containment) */
  protected _eGenericExceptions: EListImpl<EGenericType> = new EListImpl<EGenericType>({
    unique: false,
    notifier: this,
  });

  /** Type parameters (containment) */
  protected _eTypeParameters: EListImpl<ETypeParameter> = new EListImpl<ETypeParameter>({
    unique: false,
    notifier: this,
  });

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  /** Container */
  get eContainingClass(): EClass {
    if (this._eContainingClass === null) {
      throw new Error('EOperation is not contained in an EClass');
    }
    return this._eContainingClass;
  }

  set eContainingClass(value: EClass) {
    this._eContainingClass = value;
  }

  get eParameters(): EList<EParameter> {
    return this._eParameters;
  }

  set eParameters(value: EList<EParameter>) {
    this._eParameters.clear();
    for (const p of value) {
      this._eParameters.add(p);
    }
  }

  /**
   * DERIVED — excepciones obtenidas desde eGenericExceptions (erasure).
   */
  get eExceptions(): EClassifier[] {
    const result: EClassifier[] = [];
    for (const gt of this._eGenericExceptions) {
      const raw = gt.eRawType ?? gt.eClassifier;
      if (raw) {
        result.push(raw);
      }
    }
    return result;
  }

  get eGenericExceptions(): EGenericType[] {
    return this._eGenericExceptions;
  }

  set eGenericExceptions(value: EGenericType[]) {
    this._eGenericExceptions.clear();
    for (const gt of value) {
      this._eGenericExceptions.add(gt);
    }
  }

  /**
   * Type parameters de la operación (genéricos de método).
   */
  get eTypeParameters(): ETypeParameter[] {
    return this._eTypeParameters;
  }

  set eTypeParameters(value: ETypeParameter[]) {
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
  getOperationID(): number {
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
  isOverrideOf(someOperation: EOperation): boolean {
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
