/**
 * @emf-webapp/core — EReferenceImpl
 *
 * Implementación de EReference que extiende EStructuralFeatureImpl.
 * Añade: containment=false, resolveProxies=true, eOpposite=null, eKeys=[].
 * container es DERIVED: true si eOpposite !== null && eOpposite.containment === true.
 * eReferenceType es DERIVED: si eType es EClass, lo devuelve.
 */
import { EStructuralFeatureImpl } from './EStructuralFeatureImpl.js';
import { EListImpl } from '../util/EList.js';
export class EReferenceImpl extends EStructuralFeatureImpl {
    // ==========================================================
    // Metaclass
    // ==========================================================
    static _eStaticClass = null;
    static setStaticClass(cls) {
        EReferenceImpl._eStaticClass = cls;
    }
    eClass() {
        if (EReferenceImpl._eStaticClass === null) {
            throw new Error('EReferenceImpl.eClass() not initialized');
        }
        return EReferenceImpl._eStaticClass;
    }
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _containment = false;
    _resolveProxies = true;
    _eOpposite = null;
    /** Keys para referencias con mapa (no-containment) */
    _eKeys = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Constructor
    // ==========================================================
    constructor(init) {
        super();
        if (init) {
            if (init.name !== undefined)
                this._name = init.name;
            if (init.changeable !== undefined)
                this._changeable = init.changeable;
            if (init.volatile !== undefined)
                this._volatile = init.volatile;
            if (init.transient !== undefined)
                this._transient = init.transient;
            if (init.defaultValueLiteral !== undefined)
                this._defaultValueLiteral = init.defaultValueLiteral;
            if (init.unsettable !== undefined)
                this._unsettable = init.unsettable;
            if (init.derived !== undefined)
                this._derived = init.derived;
            if (init.ordered !== undefined)
                this._ordered = init.ordered;
            if (init.unique !== undefined)
                this._unique = init.unique;
            if (init.lowerBound !== undefined)
                this._lowerBound = init.lowerBound;
            if (init.upperBound !== undefined)
                this._upperBound = init.upperBound;
            if (init.eType !== undefined)
                this._eType = init.eType;
            if (init.eGenericType !== undefined)
                this._eGenericType = init.eGenericType;
            if (init.containment !== undefined)
                this._containment = init.containment;
            if (init.resolveProxies !== undefined)
                this._resolveProxies = init.resolveProxies;
            if (init.eOpposite !== undefined)
                this._eOpposite = init.eOpposite;
            if (init.eKeys !== undefined)
                this.eKeys = init.eKeys;
        }
    }
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get containment() {
        return this._containment;
    }
    set containment(value) {
        const old = this._containment;
        this._containment = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    /**
     * DERIVED — true si esta referencia es container (eOpposite no es null
     * y eOpposite.containment es true).
     */
    get container() {
        return this._eOpposite !== null && this._eOpposite.containment;
    }
    get resolveProxies() {
        return this._resolveProxies;
    }
    set resolveProxies(value) {
        const old = this._resolveProxies;
        this._resolveProxies = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get eOpposite() {
        return this._eOpposite;
    }
    set eOpposite(value) {
        const old = this._eOpposite;
        this._eOpposite = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    /**
     * DERIVED — el tipo de la referencia como EClass.
     * Si eType es un EClass, lo devuelve directamente.
     */
    get eReferenceType() {
        const et = this._eType;
        if (!et) {
            throw new Error('EReference has no eType set');
        }
        return et;
    }
    get eKeys() {
        return this._eKeys;
    }
    set eKeys(value) {
        this._eKeys.clear();
        for (const k of value) {
            this._eKeys.add(k);
        }
    }
}
//# sourceMappingURL=EReferenceImpl.js.map