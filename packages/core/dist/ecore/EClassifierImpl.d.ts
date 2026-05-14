/**
 * @emf-webapp/core — EClassifierImpl
 *
 * Implementación base de EClassifier.
 * Añade soporte para instanceClassName, defaultValue, instanceTypeName,
 * ePackage (container), eTypeParameters.
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { EClassifier, EPackage, ETypeParameter, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare abstract class EClassifierImpl extends ENamedElementImpl implements EClassifier {
    protected _instanceClassName: string;
    protected _defaultValue: string;
    protected _instanceTypeName: string;
    protected _ePackage: EPackage | null;
    /** Type parameters (containment) */
    protected _eTypeParameters: EListImpl<ETypeParameter>;
    constructor(name?: string, instanceClassName?: string);
    get instanceClassName(): string;
    set instanceClassName(value: string);
    /** DERIVED, transient — devuelve la clase JS asociada o null */
    get instanceClass(): any;
    get defaultValue(): string;
    set defaultValue(value: string);
    get instanceTypeName(): string;
    set instanceTypeName(value: string);
    get ePackage(): EPackage;
    set ePackage(value: EPackage);
    get eTypeParameters(): EList<ETypeParameter>;
    set eTypeParameters(value: EList<ETypeParameter>);
    isInstance(object: any): boolean;
    abstract getClassifierID(): number;
}
//# sourceMappingURL=EClassifierImpl.d.ts.map