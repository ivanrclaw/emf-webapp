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
import type { EStructuralFeature, EClass, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare abstract class EStructuralFeatureImpl extends EObjectImpl implements EStructuralFeature {
    /** @inheritdoc */
    protected _changeable: boolean;
    /** @inheritdoc */
    protected _volatile: boolean;
    /** @inheritdoc */
    protected _transient: boolean;
    /** @inheritdoc */
    protected _defaultValueLiteral: string;
    /** @inheritdoc */
    protected _unsettable: boolean;
    /** @inheritdoc */
    protected _derived: boolean;
    /** eContainingClass — la EClass que contiene este feature */
    protected _eContainingClass: EClass | null;
    /** eAnnotations (desde EModelElement) */
    protected _eAnnotations: EListImpl<any>;
    /** name (desde ENamedElement) */
    protected _name: string;
    /** ordered (desde ETypedElement) */
    protected _ordered: boolean;
    /** unique (desde ETypedElement) */
    protected _unique: boolean;
    /** lowerBound (desde ETypedElement) */
    protected _lowerBound: number;
    /** upperBound (desde ETypedElement) */
    protected _upperBound: number;
    /** eType (desde ETypedElement) */
    protected _eType: any;
    /** eGenericType (desde ETypedElement) */
    protected _eGenericType: any;
    get eAnnotations(): EList<any>;
    set eAnnotations(value: EList<any>);
    getEAnnotation(source: string): any;
    get name(): string;
    set name(value: string);
    get ordered(): boolean;
    set ordered(value: boolean);
    get unique(): boolean;
    set unique(value: boolean);
    get lowerBound(): number;
    set lowerBound(value: number);
    get upperBound(): number;
    set upperBound(value: number);
    /** DERIVED: upperBound < 0 || upperBound > 1 */
    get many(): boolean;
    /** DERIVED: lowerBound > 0 */
    get required(): boolean;
    get eType(): any;
    set eType(value: any);
    get eGenericType(): any;
    set eGenericType(value: any);
    get changeable(): boolean;
    set changeable(value: boolean);
    get volatile(): boolean;
    set volatile(value: boolean);
    get transient(): boolean;
    set transient(value: boolean);
    get defaultValueLiteral(): string;
    set defaultValueLiteral(value: string);
    get unsettable(): boolean;
    set unsettable(value: boolean);
    get derived(): boolean;
    set derived(value: boolean);
    /**
     * DERIVED — valor por defecto.
     * - Si hay defaultValueLiteral, usa EFactory.createFromString(eType, literal).
     * - Si no, usa el defaultValue del eType (EClassifier.defaultValue).
     */
    get defaultValue(): any;
    /**
     * Container — eContainingClass.
     * Se setea vía eSetContainer (heredado de EObjectImpl).
     */
    get eContainingClass(): EClass;
    /**
     * Devuelve el featureID como el índice en eAllStructuralFeatures
     * de la eContainingClass.
     */
    getFeatureID(): number;
    /**
     * Devuelve la clase contenedora (instanceClass de eContainingClass).
     */
    getContainerClass(): any;
}
//# sourceMappingURL=EStructuralFeatureImpl.d.ts.map