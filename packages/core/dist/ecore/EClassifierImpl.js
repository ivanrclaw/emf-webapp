/**
 * @emf-webapp/core — EClassifierImpl
 *
 * Implementación base de EClassifier.
 * Añade soporte para instanceClassName, defaultValue, instanceTypeName,
 * ePackage (container), eTypeParameters.
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import { EListImpl } from '../util/EList.js';
export class EClassifierImpl extends ENamedElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _instanceClassName = '';
    _defaultValue = '';
    _instanceTypeName = '';
    _ePackage = null;
    /** Type parameters (containment) */
    _eTypeParameters = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Constructor
    // ==========================================================
    constructor(name, instanceClassName) {
        super(name);
        if (instanceClassName !== undefined) {
            this._instanceClassName = instanceClassName;
        }
    }
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get instanceClassName() {
        return this._instanceClassName;
    }
    set instanceClassName(value) {
        const old = this._instanceClassName;
        this._instanceClassName = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    /** DERIVED, transient — devuelve la clase JS asociada o null */
    get instanceClass() {
        if (!this._instanceClassName) {
            return null;
        }
        try {
            return globalThis[this._instanceClassName] ?? null;
        }
        catch {
            return null;
        }
    }
    get defaultValue() {
        return this._defaultValue;
    }
    set defaultValue(value) {
        const old = this._defaultValue;
        this._defaultValue = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get instanceTypeName() {
        return this._instanceTypeName;
    }
    set instanceTypeName(value) {
        const old = this._instanceTypeName;
        this._instanceTypeName = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get ePackage() {
        if (this._ePackage === null) {
            throw new Error('EClassifier is not contained in an EPackage');
        }
        return this._ePackage;
    }
    set ePackage(value) {
        this._ePackage = value;
    }
    get eTypeParameters() {
        return this._eTypeParameters;
    }
    set eTypeParameters(value) {
        this._eTypeParameters.clear();
        for (let i = 0; i < value.size(); i++) {
            this._eTypeParameters.add(value.get(i));
        }
    }
    // ==========================================================
    // Métodos
    // ==========================================================
    isInstance(object) {
        if (object === null || object === undefined) {
            return false;
        }
        const cls = this.instanceClass;
        if (cls && typeof cls === 'function') {
            return object instanceof cls;
        }
        return typeof object === this._instanceClassName.toLowerCase();
    }
}
//# sourceMappingURL=EClassifierImpl.js.map