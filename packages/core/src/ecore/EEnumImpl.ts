/**
 * @emf-webapp/core — EEnumImpl + EEnumLiteralImpl
 *
 * Implementación de EEnum con eLiterals y métodos de búsqueda.
 * Implementación de EEnumLiteral con value, literal, instance.
 */
import { EDataTypeImpl } from './EDataTypeImpl.js';
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { EEnum, EEnumLiteral } from './interfaces.js';
import { EListImpl } from '../util/EList.js';

// ============================================================
// EEnumLiteralImpl
// ============================================================

export class EEnumLiteralImpl extends ENamedElementImpl implements EEnumLiteral {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _value: number = 0;
  protected _literal: string = '';
  protected _eEnum: EEnum | null = null;

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get value(): number {
    return this._value;
  }

  set value(value: number) {
    const old = this._value;
    this._value = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get literal(): string {
    return this._literal;
  }

  set literal(value: string) {
    const old = this._literal;
    this._literal = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  /**
   * DERIVED — la instancia del literal (el literal mismo).
   */
  get instance(): any {
    return this;
  }

  /** Container */
  get eEnum(): EEnum {
    if (this._eEnum === null) {
      throw new Error('EEnumLiteral is not contained in an EEnum');
    }
    return this._eEnum;
  }

  set eEnum(value: EEnum) {
    this._eEnum = value;
  }

  toString(): string {
    return this._literal || this._name;
  }
}

// ============================================================
// EEnumImpl
// ============================================================

export class EEnumImpl extends EDataTypeImpl implements EEnum {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  /** Lista de literales (containment) */
  protected _eLiterals: EListImpl<EEnumLiteral> = new EListImpl<EEnumLiteral>({
    unique: false,
    notifier: this,
  });

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get eLiterals(): EEnumLiteral[] {
    return this._eLiterals;
  }

  set eLiterals(value: EEnumLiteral[]) {
    this._eLiterals.clear();
    for (const lit of value) {
      this._eLiterals.add(lit);
    }
  }

  /** Serialización: false para enums (no serializables como cadena simple) */
  get serializable(): boolean {
    return this._serializable;
  }

  set serializable(value: boolean) {
    this._serializable = value;
  }

  // ==========================================================
  // Métodos de búsqueda
  // ==========================================================

  /**
   * Busca un literal por nombre.
   */
  getEEnumLiteral(name: string): EEnumLiteral | null;

  /**
   * Busca un literal por valor numérico.
   */
  getEEnumLiteral(value: number): EEnumLiteral | null;

  /**
   * Busca un literal por su string literal.
   */
  getEEnumLiteral(literal: string): EEnumLiteral | null;

  getEEnumLiteral(id: string | number): EEnumLiteral | null {
    if (typeof id === 'number') {
      // Buscar por value
      for (const lit of this._eLiterals) {
        if (lit.value === id) {
          return lit;
        }
      }
      return null;
    } else {
      // Buscar primero por name, luego por literal
      for (const lit of this._eLiterals) {
        if (lit.name === id) {
          return lit;
        }
      }
      for (const lit of this._eLiterals) {
        if (lit.literal === id) {
          return lit;
        }
      }
      return null;
    }
  }

  /**
   * Override: los EEnum retornan un classifierID específico.
   */
  getClassifierID(): number {
    return 17; // Convención: 17 para EEnum
  }

  toString(): string {
    return `${this._name} { ${this._eLiterals.map((l) => l.toString()).join(', ')} }`;
  }
}
