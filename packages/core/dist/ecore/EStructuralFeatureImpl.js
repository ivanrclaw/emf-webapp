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
import { EListImpl } from '../util/EList.js';
export class EStructuralFeatureImpl extends EObjectImpl {
    // ==========================================================
    // Almacenamiento interno
    // ==========================================================
    /** @inheritdoc */
    _changeable = true;
    /** @inheritdoc */
    _volatile = false;
    /** @inheritdoc */
    _transient = false;
    /** @inheritdoc */
    _defaultValueLiteral = '';
    /** @inheritdoc */
    _unsettable = false;
    /** @inheritdoc */
    _derived = false;
    /** eContainingClass — la EClass que contiene este feature */
    _eContainingClass = null;
    // ==========================================================
    // Propiedades heredadas de la cadena EObject → EStructuralFeature
    // ==========================================================
    /** eAnnotations (desde EModelElement) */
    _eAnnotations = new EListImpl({
        unique: false,
        notifier: this,
    });
    /** name (desde ENamedElement) */
    _name = '';
    /** ordered (desde ETypedElement) */
    _ordered = true;
    /** unique (desde ETypedElement) */
    _unique = false;
    /** lowerBound (desde ETypedElement) */
    _lowerBound = 0;
    /** upperBound (desde ETypedElement) */
    _upperBound = 1;
    /** eType (desde ETypedElement) */
    _eType = null;
    /** eGenericType (desde ETypedElement) */
    _eGenericType = null;
    // ==========================================================
    // EModelElement
    // ==========================================================
    get eAnnotations() {
        return this._eAnnotations;
    }
    set eAnnotations(value) {
        this._eAnnotations.clear();
        for (const v of value) {
            this._eAnnotations.add(v);
        }
    }
    getEAnnotation(source) {
        for (let i = 0; i < this._eAnnotations.size(); i++) {
            const ann = this._eAnnotations.get(i);
            if (ann.source === source)
                return ann;
        }
        return null;
    }
    // ==========================================================
    // ENamedElement
    // ==========================================================
    get name() {
        return this._name;
    }
    set name(value) {
        const old = this._name;
        this._name = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    // ==========================================================
    // ETypedElement
    // ==========================================================
    get ordered() {
        return this._ordered;
    }
    set ordered(value) {
        const old = this._ordered;
        this._ordered = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get unique() {
        return this._unique;
    }
    set unique(value) {
        const old = this._unique;
        this._unique = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get lowerBound() {
        return this._lowerBound;
    }
    set lowerBound(value) {
        const old = this._lowerBound;
        this._lowerBound = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get upperBound() {
        return this._upperBound;
    }
    set upperBound(value) {
        const old = this._upperBound;
        this._upperBound = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    /** DERIVED: upperBound < 0 || upperBound > 1 */
    get many() {
        return this._upperBound < 0 || this._upperBound > 1;
    }
    /** DERIVED: lowerBound > 0 */
    get required() {
        return this._lowerBound > 0;
    }
    get eType() {
        return this._eType;
    }
    set eType(value) {
        const old = this._eType;
        this._eType = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get eGenericType() {
        return this._eGenericType;
    }
    set eGenericType(value) {
        const old = this._eGenericType;
        this._eGenericType = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    // ==========================================================
    // EStructuralFeature
    // ==========================================================
    get changeable() {
        return this._changeable;
    }
    set changeable(value) {
        const old = this._changeable;
        this._changeable = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get volatile() {
        return this._volatile;
    }
    set volatile(value) {
        const old = this._volatile;
        this._volatile = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get transient() {
        return this._transient;
    }
    set transient(value) {
        const old = this._transient;
        this._transient = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get defaultValueLiteral() {
        return this._defaultValueLiteral;
    }
    set defaultValueLiteral(value) {
        const old = this._defaultValueLiteral;
        this._defaultValueLiteral = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get unsettable() {
        return this._unsettable;
    }
    set unsettable(value) {
        const old = this._unsettable;
        this._unsettable = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get derived() {
        return this._derived;
    }
    set derived(value) {
        const old = this._derived;
        this._derived = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    /**
     * DERIVED — valor por defecto.
     * - Si hay defaultValueLiteral, usa EFactory.createFromString(eType, literal).
     * - Si no, usa el defaultValue del eType (EClassifier.defaultValue).
     */
    get defaultValue() {
        if (this._defaultValueLiteral !== '') {
            const type = this._eType;
            if (type && typeof type.ePackage?.eFactoryInstance?.createFromString === 'function') {
                const factory = type.ePackage.eFactoryInstance;
                return factory.createFromString(type, this._defaultValueLiteral);
            }
            // Fallback: devolver el literal como string
            return this._defaultValueLiteral;
        }
        // Sin literal: defaultValue del eType (EClassifier.defaultValue)
        if (this._eType && this._eType.defaultValue !== undefined) {
            return this._eType.defaultValue;
        }
        return null;
    }
    /**
     * Container — eContainingClass.
     * Se setea vía eSetContainer (heredado de EObjectImpl).
     */
    get eContainingClass() {
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
    getFeatureID() {
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
    getContainerClass() {
        if (this._eContainingClass === null) {
            return null;
        }
        return this._eContainingClass.instanceClass;
    }
}
//# sourceMappingURL=EStructuralFeatureImpl.js.map