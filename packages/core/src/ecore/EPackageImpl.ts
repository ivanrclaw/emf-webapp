/**
 * @emf-webapp/core — EPackageImpl
 *
 * Implementación de EPackage con eClassifiers, eSubpackages,
 * eFactoryInstance, getEClassifier(name).
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import { EFactoryImpl } from './EFactoryImpl.js';
import type { EPackage, EClassifier, EFactory } from './interfaces.js';
import { EListImpl } from '../util/EList.js';

export class EPackageImpl extends ENamedElementImpl implements EPackage {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _nsURI: string = '';
  protected _nsPrefix: string = '';

  /** Clasificadores contenidos (containment) */
  protected _eClassifiers: EListImpl<EClassifier> = new EListImpl<EClassifier>({
    unique: true,
    notifier: this,
  });

  /** Subpaquetes (containment) */
  protected _eSubpackages: EListImpl<EPackage> = new EListImpl<EPackage>({
    unique: true,
    notifier: this,
  });

  /** Super paquete */
  protected _eSuperPackage: EPackage | null = null;

  /** Fábrica asociada (containment) */
  protected _eFactoryInstance: EFactory | null = null;

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get nsURI(): string {
    return this._nsURI;
  }

  set nsURI(value: string) {
    const old = this._nsURI;
    this._nsURI = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get nsPrefix(): string {
    return this._nsPrefix;
  }

  set nsPrefix(value: string) {
    const old = this._nsPrefix;
    this._nsPrefix = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get eClassifiers(): EClassifier[] {
    return this._eClassifiers;
  }

  set eClassifiers(value: EClassifier[]) {
    this._eClassifiers.clear();
    for (const c of value) {
      this._eClassifiers.add(c);
      // Establecer el contenedor del clasificador
      if ('ePackage' in c) {
        (c as any).ePackage = this;
      }
    }
  }

  get eSubpackages(): EPackage[] {
    return this._eSubpackages;
  }

  set eSubpackages(value: EPackage[]) {
    this._eSubpackages.clear();
    for (const pkg of value) {
      this._eSubpackages.add(pkg);
      // Establecer el contenedor del subpaquete
      (pkg as any)._eSuperPackage = this;
    }
  }

  /** DERIVED, transient */
  get eSuperPackage(): EPackage | null {
    return this._eSuperPackage;
  }

  get eFactoryInstance(): EFactory {
    if (this._eFactoryInstance === null) {
      // Crear fábrica por defecto
      this._eFactoryInstance = new EFactoryImpl();
      (this._eFactoryInstance as any).ePackage = this;
    }
    return this._eFactoryInstance;
  }

  set eFactoryInstance(value: EFactory) {
    this._eFactoryInstance = value;
    if (value) {
      (value as any).ePackage = this;
    }
  }

  // ==========================================================
  // Métodos
  // ==========================================================

  /**
   * Busca un clasificador por nombre.
   */
  getEClassifier(name: string): EClassifier | null {
    for (const c of this._eClassifiers) {
      if (c.name === name) {
        return c;
      }
    }
    return null;
  }

  toString(): string {
    return `${this._name} (nsURI: ${this._nsURI}, nsPrefix: ${this._nsPrefix})`;
  }
}
