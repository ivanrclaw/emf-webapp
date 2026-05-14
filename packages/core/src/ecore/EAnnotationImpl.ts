/**
 * @emf-webapp/core — EAnnotationImpl
 *
 * Implementación de EAnnotation con source, details, contents, references.
 */
import { EModelElementImpl } from './EModelElementImpl.js';
import type { EAnnotation, EObject, EModelElement, EClass, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';

export class EAnnotationImpl extends EModelElementImpl implements EAnnotation {
  // ==========================================================
  // Metaclass
  // ==========================================================

  private static _eStaticClass: EClass | null = null;

  static setStaticClass(cls: EClass): void {
    EAnnotationImpl._eStaticClass = cls;
  }

  eClass(): EClass {
    if (EAnnotationImpl._eStaticClass === null) {
      throw new Error('EAnnotationImpl.eClass() not initialized');
    }
    return EAnnotationImpl._eStaticClass;
  }

  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _source: string = '';
  protected _details: Record<string, string> = {};
  protected _eModelElement: EModelElement | null = null;

  /** Contenidos (EObjects contenidos) — containment */
  protected _contents: EListImpl<EObject> = new EListImpl<EObject>({
    unique: false,
    notifier: this,
  });

  /** Referencias a otros EObjects — no containment */
  protected _references: EListImpl<EObject> = new EListImpl<EObject>({
    unique: false,
    notifier: this,
  });

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get source(): string {
    return this._source;
  }

  set source(value: string) {
    const old = this._source;
    this._source = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get details(): Record<string, string> {
    return this._details;
  }

  set details(value: Record<string, string>) {
    const old = this._details;
    this._details = { ...value };
    this.fireNotification(1, -1, old, value, -1);
  }

  get contents(): EList<EObject> {
    return this._contents;
  }

  set contents(value: EList<EObject>) {
    this._contents.clear();
    for (const obj of value) {
      this._contents.add(obj);
    }
  }

  get references(): EList<EObject> {
    return this._references;
  }

  set references(value: EList<EObject>) {
    this._references.clear();
    for (const obj of value) {
      this._references.add(obj);
    }
  }

  /** Container (transient) */
  get eModelElement(): EModelElement | null {
    return this._eModelElement;
  }

  set eModelElement(value: EModelElement | null) {
    this._eModelElement = value;
  }
}
