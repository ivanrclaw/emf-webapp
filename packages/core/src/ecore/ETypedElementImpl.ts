/**
 * @emf-webapp/core — ETypedElementImpl
 *
 * Implementación base de ETypedElement.
 * Añade soporte para tipo, cardinalidad, ordered, unique.
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { ETypedElement, EClassifier, EGenericType } from './interfaces.js';

export abstract class ETypedElementImpl extends ENamedElementImpl implements ETypedElement {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _ordered: boolean = true;
  protected _unique: boolean = false;
  protected _lowerBound: number = 0;
  protected _upperBound: number = 1;
  protected _eType: EClassifier | null = null;
  protected _eGenericType: EGenericType | null = null;

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get ordered(): boolean {
    return this._ordered;
  }

  set ordered(value: boolean) {
    const old = this._ordered;
    this._ordered = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get unique(): boolean {
    return this._unique;
  }

  set unique(value: boolean) {
    const old = this._unique;
    this._unique = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get lowerBound(): number {
    return this._lowerBound;
  }

  set lowerBound(value: number) {
    const old = this._lowerBound;
    this._lowerBound = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get upperBound(): number {
    return this._upperBound;
  }

  set upperBound(value: number) {
    const old = this._upperBound;
    this._upperBound = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  /** DERIVED: upperBound < 0 || upperBound > 1 */
  get many(): boolean {
    return this._upperBound < 0 || this._upperBound > 1;
  }

  /** DERIVED: lowerBound > 0 */
  get required(): boolean {
    return this._lowerBound > 0;
  }

  get eType(): EClassifier | null {
    return this._eType;
  }

  set eType(value: EClassifier | null) {
    const old = this._eType;
    this._eType = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get eGenericType(): EGenericType | null {
    return this._eGenericType;
  }

  set eGenericType(value: EGenericType | null) {
    const old = this._eGenericType;
    this._eGenericType = value;
    this.fireNotification(1, -1, old, value, -1);
  }
}
