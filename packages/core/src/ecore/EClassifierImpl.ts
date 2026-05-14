/**
 * @emf-webapp/core — EClassifierImpl
 *
 * Implementación base de EClassifier.
 * Añade soporte para instanceClassName, defaultValue, instanceTypeName,
 * ePackage (container), eTypeParameters.
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { EClassifier, EPackage, ETypeParameter, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';

export abstract class EClassifierImpl extends ENamedElementImpl implements EClassifier {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _instanceClassName: string = '';
  protected _defaultValue: string = '';
  protected _instanceTypeName: string = '';
  protected _ePackage: EPackage | null = null;

  /** Type parameters (containment) */
  protected _eTypeParameters: EListImpl<ETypeParameter> = new EListImpl<ETypeParameter>({
    unique: false,
    notifier: this,
  });

  // ==========================================================
  // Constructor
  // ==========================================================

  constructor(name?: string, instanceClassName?: string) {
    super(name);
    if (instanceClassName !== undefined) {
      this._instanceClassName = instanceClassName;
    }
  }

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get instanceClassName(): string {
    return this._instanceClassName;
  }

  set instanceClassName(value: string) {
    const old = this._instanceClassName;
    this._instanceClassName = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  /** DERIVED, transient — devuelve la clase JS asociada o null */
  get instanceClass(): any {
    if (!this._instanceClassName) {
      return null;
    }
    try {
      return (globalThis as any)[this._instanceClassName] ?? null;
    } catch {
      return null;
    }
  }

  get defaultValue(): string {
    return this._defaultValue;
  }

  set defaultValue(value: string) {
    const old = this._defaultValue;
    this._defaultValue = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get instanceTypeName(): string {
    return this._instanceTypeName;
  }

  set instanceTypeName(value: string) {
    const old = this._instanceTypeName;
    this._instanceTypeName = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get ePackage(): EPackage {
    if (this._ePackage === null) {
      throw new Error('EClassifier is not contained in an EPackage');
    }
    return this._ePackage;
  }

  set ePackage(value: EPackage) {
    this._ePackage = value;
  }

  get eTypeParameters(): EList<ETypeParameter> {
    return this._eTypeParameters;
  }

  set eTypeParameters(value: EList<ETypeParameter>) {
    this._eTypeParameters.clear();
    for (let i = 0; i < value.size(); i++) {
      this._eTypeParameters.add(value.get(i));
    }
  }

  // ==========================================================
  // Métodos
  // ==========================================================

  isInstance(object: any): boolean {
    if (object === null || object === undefined) {
      return false;
    }
    const cls = this.instanceClass;
    if (cls && typeof cls === 'function') {
      return object instanceof cls;
    }
    return typeof object === this._instanceClassName.toLowerCase();
  }

  abstract getClassifierID(): number;
}
