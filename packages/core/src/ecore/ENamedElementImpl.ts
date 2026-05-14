/**
 * @emf-webapp/core — ENamedElementImpl
 *
 * Implementación base de ENamedElement.
 * Añade la propiedad name.
 */
import { EModelElementImpl } from './EModelElementImpl.js';
import type { ENamedElement } from './interfaces.js';

export abstract class ENamedElementImpl extends EModelElementImpl implements ENamedElement {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _name: string = '';

  // ==========================================================
  // Constructor
  // ==========================================================

  constructor(name?: string) {
    super();
    if (name !== undefined) {
      this._name = name;
    }
  }

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    const oldValue = this._name;
    this._name = value;
    // Notificar cambio
    this.fireNotification(1, -1, oldValue, value, -1);
  }
}
