/**
 * @emf-webapp/core — EStructuralFeatureImpl
 *
 * Implementación base de EStructuralFeature que extiende EObjectImpl.
 * Añade propiedades: changeable, volatile, transient, defaultValueLiteral,
 * unsettable, derived. defaultValue es DERIVED (si hay defaultValueLiteral
 * usa EFactory.createFromString() sobre el eType como EDataType; si no,
 * usa el defaultValue del eType). eContainingClass se setea via contenedor
 * (eSetContainer heredado de EObjectImpl).
 */
import { EObjectImpl } from './EObjectImpl.js';
import type { EStructuralFeature, EClass, EDataType, EFactory, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';

export abstract class EStructuralFeatureImpl extends EObjectImpl implements EStructuralFeature {
  // ==========================================================
  // Almacenamiento interno
  // ==========================================================

  /** @inheritdoc */
  protected _changeable: boolean = true;

  /** @inheritdoc */
  protected _volatile: boolean = false;

  /** @inheritdoc */
  protected _transient: boolean = false;

  /** @inheritdoc */
  protected _defaultValueLiteral: string = '';

  /** @inheritdoc */
  protected _unsettable: boolean = false;

  /** @inheritdoc */
  protected _derived: boolean = false;

  /** eContainingClass — la EClass que contiene este feature */
  protected _eContainingClass: EClass | null = null;

  // ==========================================================
  // Propiedades heredadas de la cadena EObject → EStructuralFeature
  // ==========================================================

  /** eAnnotations (desde EModelElement) */
  protected _eAnnotations: EListImpl<any> = new EListImpl<any>({
    unique: false,
    notifier: this,
  });

  /** name (desde ENamedElement) */
  protected _name: string = '';

  /** ordered (desde ETypedElement) */
  protected _ordered: boolean = true;

  /** unique (desde ETypedElement) */
  protected _unique: boolean = false;

  /** lowerBound (desde ETypedElement) */
  protected _lowerBound: number = 0;

  /** upperBound (desde ETypedElement) */
  protected _upperBound: number = 1;

  /** eType (desde ETypedElement) */
  protected _eType: any = null;

  /** eGenericType (desde ETypedElement) */
  protected _eGenericType: any = null;

  // ==========================================================
  // EModelElement
  // ==========================================================

  get eAnnotations(): EList<any> {
    return this._eAnnotations;
  }

  set eAnnotations(value: EList<any>) {
    this._eAnnotations.clear();
    for (const v of value) {
      this._eAnnotations.add(v);
    }
  }

  getEAnnotation(source: string): any {
    for (let i = 0; i < this._eAnnotations.size(); i++) {
      const ann = this._eAnnotations.get(i);
      if (ann.source === source) return ann;
    }
    return null;
  }

  // ==========================================================
  // ENamedElement
  // ==========================================================

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    const old = this._name;
    this._name = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  // ==========================================================
  // ETypedElement
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

  get eType(): any {
    return this._eType;
  }

  set eType(value: any) {
    const old = this._eType;
    this._eType = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get eGenericType(): any {
    return this._eGenericType;
  }

  set eGenericType(value: any) {
    const old = this._eGenericType;
    this._eGenericType = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  // ==========================================================
  // EStructuralFeature
  // ==========================================================

  get changeable(): boolean {
    return this._changeable;
  }

  set changeable(value: boolean) {
    const old = this._changeable;
    this._changeable = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get volatile(): boolean {
    return this._volatile;
  }

  set volatile(value: boolean) {
    const old = this._volatile;
    this._volatile = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get transient(): boolean {
    return this._transient;
  }

  set transient(value: boolean) {
    const old = this._transient;
    this._transient = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get defaultValueLiteral(): string {
    return this._defaultValueLiteral;
  }

  set defaultValueLiteral(value: string) {
    const old = this._defaultValueLiteral;
    this._defaultValueLiteral = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get unsettable(): boolean {
    return this._unsettable;
  }

  set unsettable(value: boolean) {
    const old = this._unsettable;
    this._unsettable = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  get derived(): boolean {
    return this._derived;
  }

  set derived(value: boolean) {
    const old = this._derived;
    this._derived = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  /**
   * DERIVED — valor por defecto.
   * - Si hay defaultValueLiteral, usa EFactory.createFromString(eType, literal).
   * - Si no, usa el defaultValue del eType (EClassifier.defaultValue).
   */
  get defaultValue(): any {
    if (this._defaultValueLiteral !== '') {
      const type = this._eType;
      if (type && typeof (type as any).ePackage?.eFactoryInstance?.createFromString === 'function') {
        const factory: EFactory = (type as any).ePackage.eFactoryInstance;
        return factory.createFromString(type as EDataType, this._defaultValueLiteral);
      }
      // Fallback: devolver el literal como string
      return this._defaultValueLiteral;
    }
    // Sin literal: defaultValue del eType (EClassifier.defaultValue)
    if (this._eType && (this._eType as any).defaultValue !== undefined) {
      return (this._eType as any).defaultValue;
    }
    return null;
  }

  /**
   * Container — eContainingClass.
   * Se setea vía eSetContainer (heredado de EObjectImpl).
   */
  get eContainingClass(): EClass {
    if (this._eContainingClass === null) {
      throw new Error('EStructuralFeature is not contained in an EClass');
    }
    return this._eContainingClass;
  }

  // ==========================================================
  // Métodos
  // ==========================================================

  /**
   * Devuelve el featureID como el índice en eAllStructuralFeatures
   * de la eContainingClass.
   */
  getFeatureID(): number {
    if (this._eContainingClass === null) {
      return -1;
    }
    const allFeatures = this._eContainingClass.eAllStructuralFeatures;
    const idx = allFeatures.indexOf(this);
    return idx >= 0 ? idx : -1;
  }

  /**
   * Devuelve la clase contenedora (instanceClass de eContainingClass).
   */
  getContainerClass(): any {
    if (this._eContainingClass === null) {
      return null;
    }
    return this._eContainingClass.instanceClass;
  }
}
