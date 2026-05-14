/**
 * @emf-webapp/core — EDataTypeImpl
 *
 * Implementación de EDataType que extiende EObjectImpl.
 * Añade: serializable=true, instanceClassName='java.lang.String',
 * instanceClass (DERIVED), defaultValue='', instanceTypeName='',
 * typeParameters=[], ePackage (set via container).
 */
import { EObjectImpl } from './EObjectImpl.js';
import type { EDataType, EPackage, ETypeParameter, EClass } from './interfaces.js';
import { EListImpl } from '../util/EList.js';

export class EDataTypeImpl extends EObjectImpl implements EDataType {
  // ==========================================================
  // Metaclass
  // ==========================================================

  private static _eStaticClass: EClass | null = null;

  static setStaticClass(cls: EClass): void {
    EDataTypeImpl._eStaticClass = cls;
  }

  eClass(): EClass {
    if (EDataTypeImpl._eStaticClass === null) {
      throw new Error('EDataTypeImpl.eClass() not initialized');
    }
    return EDataTypeImpl._eStaticClass;
  }

  // ==========================================================
  // Almacenamiento
  // ==========================================================

  /** @inheritdoc */
  protected _serializable: boolean = true;

  /** @inheritdoc */
  protected _instanceClassName: string = 'java.lang.String';

  /** @inheritdoc */
  protected _defaultValue: string = '';

  /** @inheritdoc */
  protected _instanceTypeName: string = '';

  /** Type parameters (containment) */
  protected _eTypeParameters: EListImpl<ETypeParameter> = new EListImpl<ETypeParameter>({
    unique: false,
    notifier: this,
  });

  /** Container EPackage */
  protected _ePackage: EPackage | null = null;

  // Props inherited from EModelElement
  protected _eAnnotations: EListImpl<any> = new EListImpl<any>({
    unique: false,
    notifier: this,
  });

  // Props inherited from ENamedElement
  protected _name: string = '';

  // ==========================================================
  // EModelElement
  // ==========================================================

  get eAnnotations(): any[] {
    return this._eAnnotations as any;
  }

  set eAnnotations(value: any[]) {
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
  // EClassifier
  // ==========================================================

  get instanceClassName(): string {
    return this._instanceClassName;
  }

  set instanceClassName(value: string) {
    const old = this._instanceClassName;
    this._instanceClassName = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  /**
   * DERIVED, transient — devuelve la clase JS asociada desde instanceClassName.
   */
  get instanceClass(): any {
    if (!this._instanceClassName) {
      return null;
    }
    // Mapeo de nombres Java estándar a constructores JS
    const javaToJS: Record<string, any> = {
      'java.lang.String': String,
      'java.lang.Boolean': Boolean,
      'java.lang.Integer': Number,
      'java.lang.Long': Number,
      'java.lang.Float': Number,
      'java.lang.Double': Number,
      'java.lang.Byte': Number,
      'java.lang.Short': Number,
      'java.lang.Character': String,
      'java.math.BigDecimal': Number,
      'java.math.BigInteger': Number,
      'java.util.Date': Date,
    };
    if (javaToJS[this._instanceClassName]) {
      return javaToJS[this._instanceClassName];
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
      throw new Error('EDataType is not contained in an EPackage');
    }
    return this._ePackage;
  }

  set ePackage(value: EPackage) {
    this._ePackage = value;
  }

  get eTypeParameters(): ETypeParameter[] {
    return this._eTypeParameters as unknown as ETypeParameter[];
  }

  set eTypeParameters(value: ETypeParameter[]) {
    this._eTypeParameters.clear();
    for (const tp of value) {
      this._eTypeParameters.add(tp);
    }
  }

  // ==========================================================
  // EDataType
  // ==========================================================

  get serializable(): boolean {
    return this._serializable;
  }

  set serializable(value: boolean) {
    const old = this._serializable;
    this._serializable = value;
    this.fireNotification(1, -1, old, value, -1);
  }

  // ==========================================================
  // Métodos
  // ==========================================================

  /**
   * Verifica si el objeto dado es instancia del tipo de dato.
   */
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

  /**
   * Devuelve el classifierID para este EDataType.
   * Basado en el nombre del tipo EDataType canónico.
   */
  getClassifierID(): number {
    if (this._name === 'EString') return 1;
    if (this._name === 'EBoolean') return 2;
    if (this._name === 'EInt') return 3;
    if (this._name === 'ELong') return 4;
    if (this._name === 'EFloat') return 5;
    if (this._name === 'EDouble') return 6;
    if (this._name === 'EByte') return 7;
    if (this._name === 'EByteArray') return 8;
    if (this._name === 'EChar') return 9;
    if (this._name === 'EShort') return 10;
    if (this._name === 'EBigDecimal') return 11;
    if (this._name === 'EBigInteger') return 12;
    if (this._name === 'EDate') return 13;
    if (this._name === 'EObject') return 14;
    if (this._name === 'EJavaObject') return 15;
    if (this._name === 'EJavaClass') return 16;
    if (this._ePackage) {
      return this._ePackage.eClassifiers.indexOf(this);
    }
    return -1;
  }
}
