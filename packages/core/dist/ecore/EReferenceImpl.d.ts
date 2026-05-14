/**
 * @emf-webapp/core — EReferenceImpl
 *
 * Implementación de EReference que extiende EStructuralFeatureImpl.
 * Añade: containment=false, resolveProxies=true, eOpposite=null, eKeys=[].
 * container es DERIVED: true si eOpposite !== null && eOpposite.containment === true.
 * eReferenceType es DERIVED: si eType es EClass, lo devuelve.
 */
import { EStructuralFeatureImpl } from './EStructuralFeatureImpl.js';
import type { EReference, EClass, EAttribute } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare class EReferenceImpl extends EStructuralFeatureImpl implements EReference {
    private static _eStaticClass;
    static setStaticClass(cls: EClass): void;
    eClass(): EClass;
    protected _containment: boolean;
    protected _resolveProxies: boolean;
    protected _eOpposite: EReference | null;
    /** Keys para referencias con mapa (no-containment) */
    protected _eKeys: EListImpl<EAttribute>;
    constructor(init?: Partial<EReference>);
    get containment(): boolean;
    set containment(value: boolean);
    /**
     * DERIVED — true si esta referencia es container (eOpposite no es null
     * y eOpposite.containment es true).
     */
    get container(): boolean;
    get resolveProxies(): boolean;
    set resolveProxies(value: boolean);
    get eOpposite(): EReference | null;
    set eOpposite(value: EReference | null);
    /**
     * DERIVED — el tipo de la referencia como EClass.
     * Si eType es un EClass, lo devuelve directamente.
     */
    get eReferenceType(): EClass;
    get eKeys(): EAttribute[];
    set eKeys(value: EAttribute[]);
}
//# sourceMappingURL=EReferenceImpl.d.ts.map