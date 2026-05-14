/**
 * @emf-webapp/core — EGenericTypeImpl + ETypeParameterImpl
 *
 * Implementación de EGenericType con eUpperBound, eTypeArguments, eRawType (derived),
 * eLowerBound, eTypeParameter, eClassifier.
 * Implementación de ETypeParameter con eBounds.
 */
import { EObjectImpl } from './EObjectImpl.js';
import { ENamedElementImpl } from './ENamedElementImpl.js';
import { EListImpl } from '../util/EList.js';
// ============================================================
// EGenericTypeImpl
// ============================================================
export class EGenericTypeImpl extends EObjectImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _eUpperBound = null;
    _eLowerBound = null;
    _eTypeParameter = null;
    _eClassifier = null;
    /** Type arguments (containment) */
    _eTypeArguments = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get eUpperBound() {
        return this._eUpperBound;
    }
    set eUpperBound(value) {
        const old = this._eUpperBound;
        this._eUpperBound = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get eTypeArguments() {
        return this._eTypeArguments;
    }
    set eTypeArguments(value) {
        this._eTypeArguments.clear();
        for (const ta of value) {
            this._eTypeArguments.add(ta);
        }
    }
    /**
     * DERIVED — el tipo crudo (erasure).
     * Si hay eClassifier, ese es el raw type.
     * Si hay eTypeParameter, el raw type es null (se resuelve en el contexto).
     */
    get eRawType() {
        // Si tenemos classifier directo, es el raw type
        if (this._eClassifier !== null) {
            return this._eClassifier;
        }
        // Si tenemos type parameter, intentar obtener del bound
        if (this._eTypeParameter !== null) {
            const bounds = this._eTypeParameter.eBounds;
            if (bounds.length > 0) {
                return bounds[0].eRawType ?? bounds[0].eClassifier;
            }
            return null; // type parameter sin bound
        }
        // Si tenemos upper bound, ese es el raw type
        if (this._eUpperBound !== null) {
            return this._eUpperBound;
        }
        // Si tenemos type arguments, intentar con el primero
        if (this._eTypeArguments.length > 0) {
            return this._eTypeArguments.get(0).eRawType;
        }
        return null;
    }
    get eLowerBound() {
        return this._eLowerBound;
    }
    set eLowerBound(value) {
        const old = this._eLowerBound;
        this._eLowerBound = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get eTypeParameter() {
        return this._eTypeParameter;
    }
    set eTypeParameter(value) {
        const old = this._eTypeParameter;
        this._eTypeParameter = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get eClassifier() {
        return this._eClassifier;
    }
    set eClassifier(value) {
        const old = this._eClassifier;
        this._eClassifier = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    toString() {
        if (this._eClassifier !== null) {
            const name = this._eClassifier.name;
            if (this._eTypeArguments.size() > 0) {
                return `${name}<${this._eTypeArguments.toArray().map((a) => a.toString()).join(', ')}>`;
            }
            return name;
        }
        if (this._eTypeParameter !== null) {
            return this._eTypeParameter.name;
        }
        return '?';
    }
}
// ============================================================
// ETypeParameterImpl
// ============================================================
export class ETypeParameterImpl extends ENamedElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    /** Bounds (containment) */
    _eBounds = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get eBounds() {
        return this._eBounds;
    }
    set eBounds(value) {
        this._eBounds.clear();
        for (const b of value) {
            this._eBounds.add(b);
        }
    }
    toString() {
        if (this._eBounds.size() > 0) {
            return `${this._name} extends ${this._eBounds.toArray().map((b) => b.toString()).join(' & ')}`;
        }
        return this._name;
    }
}
//# sourceMappingURL=EGenericTypeImpl.js.map