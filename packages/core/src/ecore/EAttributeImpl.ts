/**
 * @emf-webapp/core — EAttributeImpl
 *
 * Implementación de EAttribute que extiende EStructuralFeatureImpl.
 * Añade iD=false y eAttributeType (DERIVED: si eType es EDataType, lo devuelve).
 * Constructor acepta Partial<EAttribute> para inicialización.
 */
import { EStructuralFeatureImpl } from './EStructuralFeatureImpl.js';
import type { EAttribute, EDataType, EClass } from './interfaces.js';

export class EAttributeImpl extends EStructuralFeatureImpl implements EAttribute {
  // ==========================================================
  // Metaclass
  // ==========================================================

  private static _eStaticClass: EClass | null = null;

  static setStaticClass(cls: EClass): void {
    EAttributeImpl._eStaticClass = cls;
  }

  eClass(): EClass {
    if (EAttributeImpl._eStaticClass === null) {
      throw new Error('EAttributeImpl.eClass() not initialized');
    }
    return EAttributeImpl._eStaticClass;
  }

  // ==========================================================
  // Almacenamiento
  // ==========================================================

  protected _iD: boolean = false;

  // ==========================================================
  // Constructor
  // ==========================================================

  constructor(init?: Partial<EAttribute>) {
    super();
    if (init) {
      if (init.name !== undefined) this._name = init.name;
      if (init.changeable !== undefined) this._changeable = init.changeable;
      if (init.volatile !== undefined) this._volatile = init.volatile;
      if (init.transient !== undefined) this._transient = init.transient;
      if (init.defaultValueLiteral !== undefined) this._defaultValueLiteral = init.defaultValueLiteral;
      if (init.unsettable !== undefined) this._unsettable = init.unsettable;
      if (init.derived !== undefined) this._derived = init.derived;
      if (init.ordered !== undefined) this._ordered = init.ordered;
      if (init.unique !== undefined) this._unique = init.unique;
      if (init.lowerBound !== undefined) this._lowerBound = init.lowerBound;
      if (init.upperBound !== undefined) this._upperBound = init.upperBound;
      if (init.eType !== undefined) this._eType = init.eType;
      if (init.eGenericType !== undefined) this._eGenericType = init.eGenericType;
      if (init.iD !== undefined) this._iD = init.iD;
      if (init.eAnnotations !== undefined) (this as any).eAnnotations = init.eAnnotations;
    }
  }

  // ==========================================================
  // Propiedades de interfaz
  // ==========================================================

  get iD(): boolean {
    return this._iD;
  }

  set iD(value: boolean) {
    const old = this._iD;
    this._iD = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  /**
   * DERIVED — el tipo de dato (EDataType) de este atributo.
   * Si eType es un EDataType, lo devuelve directamente.
   */
  get eAttributeType(): EDataType {
    const et = this._eType;
    if (!et) {
      throw new Error('EAttribute has no eType set');
    }
    return et as unknown as EDataType;
  }
}
