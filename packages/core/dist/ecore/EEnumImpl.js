/**
 * @emf-webapp/core — EEnumImpl + EEnumLiteralImpl
 *
 * Implementación de EEnum con eLiterals y métodos de búsqueda.
 * Implementación de EEnumLiteral con value, literal, instance.
 */
import { EDataTypeImpl } from './EDataTypeImpl.js';
import { ENamedElementImpl } from './ENamedElementImpl.js';
import { EListImpl } from '../util/EList.js';
// ============================================================
// EEnumLiteralImpl
// ============================================================
export class EEnumLiteralImpl extends ENamedElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _value = 0;
    _literal = '';
    _eEnum = null;
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get value() {
        return this._value;
    }
    set value(value) {
        const old = this._value;
        this._value = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get literal() {
        return this._literal;
    }
    set literal(value) {
        const old = this._literal;
        this._literal = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    /**
     * DERIVED — la instancia del literal (el literal mismo).
     */
    get instance() {
        return this;
    }
    /** Container */
    get eEnum() {
        if (this._eEnum === null) {
            throw new Error('EEnumLiteral is not contained in an EEnum');
        }
        return this._eEnum;
    }
    set eEnum(value) {
        this._eEnum = value;
    }
    toString() {
        return this._literal || this._name;
    }
}
// ============================================================
// EEnumImpl
// ============================================================
export class EEnumImpl extends EDataTypeImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    /** Lista de literales (containment) */
    _eLiterals = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get eLiterals() {
        return this._eLiterals;
    }
    set eLiterals(value) {
        this._eLiterals.clear();
        for (const lit of value) {
            this._eLiterals.add(lit);
        }
    }
    /** Serialización: false para enums (no serializables como cadena simple) */
    get serializable() {
        return this._serializable;
    }
    set serializable(value) {
        this._serializable = value;
    }
    getEEnumLiteral(id) {
        if (typeof id === 'number') {
            // Buscar por value
            for (const lit of this._eLiterals) {
                if (lit.value === id) {
                    return lit;
                }
            }
            return null;
        }
        else {
            // Buscar primero por name, luego por literal
            for (const lit of this._eLiterals) {
                if (lit.name === id) {
                    return lit;
                }
            }
            for (const lit of this._eLiterals) {
                if (lit.literal === id) {
                    return lit;
                }
            }
            return null;
        }
    }
    /**
     * Override: los EEnum retornan un classifierID específico.
     */
    getClassifierID() {
        return 17; // Convención: 17 para EEnum
    }
    toString() {
        return `${this._name} { ${this._eLiterals.map((l) => l.toString()).join(', ')} }`;
    }
}
//# sourceMappingURL=EEnumImpl.js.map