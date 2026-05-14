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
export declare class EDataTypeImpl extends EObjectImpl implements EDataType {
    private static _eStaticClass;
    static setStaticClass(cls: EClass): void;
    eClass(): EClass;
    /** @inheritdoc */
    protected _serializable: boolean;
    /** @inheritdoc */
    protected _instanceClassName: string;
    /** @inheritdoc */
    protected _defaultValue: string;
    /** @inheritdoc */
    protected _instanceTypeName: string;
    /** Type parameters (containment) */
    protected _eTypeParameters: EListImpl<ETypeParameter>;
    /** Container EPackage */
    protected _ePackage: EPackage | null;
    protected _eAnnotations: EListImpl<any>;
    protected _name: string;
    get eAnnotations(): any[];
    set eAnnotations(value: any[]);
    getEAnnotation(source: string): any;
    get name(): string;
    set name(value: string);
    get instanceClassName(): string;
    set instanceClassName(value: string);
    /**
     * DERIVED, transient — devuelve la clase JS asociada desde instanceClassName.
     */
    get instanceClass(): any;
    get defaultValue(): string;
    set defaultValue(value: string);
    get instanceTypeName(): string;
    set instanceTypeName(value: string);
    get ePackage(): EPackage;
    set ePackage(value: EPackage);
    get eTypeParameters(): ETypeParameter[];
    set eTypeParameters(value: ETypeParameter[]);
    get serializable(): boolean;
    set serializable(value: boolean);
    /**
     * Verifica si el objeto dado es instancia del tipo de dato.
     */
    isInstance(object: any): boolean;
    /**
     * Devuelve el classifierID para este EDataType.
     * Basado en el nombre del tipo EDataType canónico.
     */
    getClassifierID(): number;
}
//# sourceMappingURL=EDataTypeImpl.d.ts.map