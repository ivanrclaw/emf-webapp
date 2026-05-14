/**
 * @emf-webapp/core — EGenericTypeImpl + ETypeParameterImpl
 *
 * Implementación de EGenericType con eUpperBound, eTypeArguments, eRawType (derived),
 * eLowerBound, eTypeParameter, eClassifier.
 * Implementación de ETypeParameter con eBounds.
 */
import { EObjectImpl } from './EObjectImpl.js';
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { EGenericType, ETypeParameter, EClassifier } from './interfaces.js';
import { EListImpl } from '../util/EList.js';

// ============================================================
// EGenericTypeImpl
// ============================================================

export class EGenericTypeImpl extends EObjectImpl implements EGenericType {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _eUpperBound: EClassifier | null = null;
  protected _eLowerBound: EClassifier | null = null;
  protected _eTypeParameter: ETypeParameter | null = null;
  protected _eClassifier: EClassifier | null = null;

  /** Type arguments (containment) */
  protected _eTypeArguments: EListImpl<EGenericType> = new EListImpl<EGenericType>({
    unique: false,
    notifier: this,
  });

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get eUpperBound(): EClassifier | null {
    return this._eUpperBound;
  }

  set eUpperBound(value: EClassifier | null) {
    const old = this._eUpperBound;
    this._eUpperBound = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get eTypeArguments(): EGenericType[] {
    return this._eTypeArguments;
  }

  set eTypeArguments(value: EGenericType[]) {
    this._eTypeArguments.clear();
    for (const ta of value) {
      this._eTypeArguments.add(ta);
    }
  }

  /**
   * DERIVED — el tipo crudo (erasure).
   * Si hay eClassifier, ese es el raw type.
   * Si hay eTypeParameter, el raw type es null (se resuelve en el contexto).
   */
  get eRawType(): EClassifier | null {
    // Si tenemos classifier directo, es el raw type
    if (this._eClassifier !== null) {
      return this._eClassifier;
    }
    // Si tenemos type parameter, intentar obtener del bound
    if (this._eTypeParameter !== null) {
      const bounds = this._eTypeParameter.eBounds;
      if (bounds.length > 0) {
        return bounds[0].eRawType ?? bounds[0].eClassifier;
      }
      return null; // type parameter sin bound
    }
    // Si tenemos upper bound, ese es el raw type
    if (this._eUpperBound !== null) {
      return this._eUpperBound;
    }
    // Si tenemos type arguments, intentar con el primero
    if (this._eTypeArguments.length > 0) {
      return this._eTypeArguments.get(0).eRawType;
    }
    return null;
  }

  get eLowerBound(): EClassifier | null {
    return this._eLowerBound;
  }

  set eLowerBound(value: EClassifier | null) {
    const old = this._eLowerBound;
    this._eLowerBound = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get eTypeParameter(): ETypeParameter | null {
    return this._eTypeParameter;
  }

  set eTypeParameter(value: ETypeParameter | null) {
    const old = this._eTypeParameter;
    this._eTypeParameter = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get eClassifier(): EClassifier | null {
    return this._eClassifier;
  }

  set eClassifier(value: EClassifier | null) {
    const old = this._eClassifier;
    this._eClassifier = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  toString(): string {
    if (this._eClassifier !== null) {
      const name = this._eClassifier.name;
      if (this._eTypeArguments.size() > 0) {
        return `${name}<${this._eTypeArguments.toArray().map((a) => a.toString()).join(', ')}>`;
      }
      return name;
    }
    if (this._eTypeParameter !== null) {
      return this._eTypeParameter.name;
    }
    return '?';
  }
}

// ============================================================
// ETypeParameterImpl
// ============================================================

export class ETypeParameterImpl extends ENamedElementImpl implements ETypeParameter {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  /** Bounds (containment) */
  protected _eBounds: EListImpl<EGenericType> = new EListImpl<EGenericType>({
    unique: false,
    notifier: this,
  });

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get eBounds(): EGenericType[] {
    return this._eBounds;
  }

  set eBounds(value: EGenericType[]) {
    this._eBounds.clear();
    for (const b of value) {
      this._eBounds.add(b);
    }
  }

  toString(): string {
    if (this._eBounds.size() > 0) {
      return `${this._name} extends ${this._eBounds.toArray().map((b) => b.toString()).join(' & ')}`;
    }
    return this._name;
  }
}
