/**
 * @emf-webapp/core — ETypedElementImpl
 *
 * Implementación base de ETypedElement.
 * Añade soporte para tipo, cardinalidad, ordered, unique.
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
export class ETypedElementImpl extends ENamedElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _ordered = true;
    _unique = false;
    _lowerBound = 0;
    _upperBound = 1;
    _eType = null;
    _eGenericType = null;
    // ==========================================================
    // Propiedades de interfaz
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
}
//# sourceMappingURL=ETypedElementImpl.js.map