/**
 * @emf-webapp/core — EGenericTypeImpl + ETypeParameterImpl
 *
 * Implementación de EGenericType con eUpperBound, eTypeArguments, eRawType (derived),
 * eLowerBound, eTypeParameter, eClassifier.
 * Implementación de ETypeParameter con eBounds.
 */
import { EObjectImpl } from './EObjectImpl.js';
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { EGenericType, ETypeParameter, EClassifier } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare class EGenericTypeImpl extends EObjectImpl implements EGenericType {
    protected _eUpperBound: EClassifier | null;
    protected _eLowerBound: EClassifier | null;
    protected _eTypeParameter: ETypeParameter | null;
    protected _eClassifier: EClassifier | null;
    /** Type arguments (containment) */
    protected _eTypeArguments: EListImpl<EGenericType>;
    get eUpperBound(): EClassifier | null;
    set eUpperBound(value: EClassifier | null);
    get eTypeArguments(): EGenericType[];
    set eTypeArguments(value: EGenericType[]);
    /**
     * DERIVED — el tipo crudo (erasure).
     * Si hay eClassifier, ese es el raw type.
     * Si hay eTypeParameter, el raw type es null (se resuelve en el contexto).
     */
    get eRawType(): EClassifier | null;
    get eLowerBound(): EClassifier | null;
    set eLowerBound(value: EClassifier | null);
    get eTypeParameter(): ETypeParameter | null;
    set eTypeParameter(value: ETypeParameter | null);
    get eClassifier(): EClassifier | null;
    set eClassifier(value: EClassifier | null);
    toString(): string;
}
export declare class ETypeParameterImpl extends ENamedElementImpl implements ETypeParameter {
    /** Bounds (containment) */
    protected _eBounds: EListImpl<EGenericType>;
    get eBounds(): EGenericType[];
    set eBounds(value: EGenericType[]);
    toString(): string;
}
//# sourceMappingURL=EGenericTypeImpl.d.ts.map