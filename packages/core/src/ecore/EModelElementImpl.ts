/**
 * @emf-webapp/core — EModelElementImpl
 *
 * Implementación base de EModelElement.
 * Añade soporte para anotaciones (eAnnotations).
 */
import { EObjectImpl } from './EObjectImpl.js';
import type {
  EModelElement, EAnnotation, EClass, EList,
} from './interfaces.js';
import { EListImpl } from '../util/EList.js';

export abstract class EModelElementImpl extends EObjectImpl implements EModelElement {
  // ==========================================================
  // Almacenamiento
  // ==========================================================

  /** Lista de anotaciones (containment) */
  protected _eAnnotations: EListImpl<EAnnotation> = new EListImpl<EAnnotation>({
    unique: false,
    notifier: this,
  });

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get eAnnotations(): EList<EAnnotation> {
    return this._eAnnotations;
  }

  set eAnnotations(value: EList<EAnnotation>) {
    this._eAnnotations.clear();
    for (let i = 0; i < value.size(); i++) {
      this._eAnnotations.add(value.get(i));
    }
  }

  getEAnnotation(source: string): EAnnotation | null {
    const arr = this._eAnnotations;
    for (let i = 0; i < arr.size(); i++) {
      const ann = arr.get(i);
      if (ann.source === source) {
        return ann;
      }
    }
    return null;
  }
}
