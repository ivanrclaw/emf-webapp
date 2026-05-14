/**
 * @emf-webapp/core — EAttributeImpl
 *
 * Implementación de EAttribute que extiende EStructuralFeatureImpl.
 * Añade iD=false y eAttributeType (DERIVED: si eType es EDataType, lo devuelve).
 * Constructor acepta Partial<EAttribute> para inicialización.
 */
import { EStructuralFeatureImpl } from './EStructuralFeatureImpl.js';
import type { EAttribute, EDataType, EClass } from './interfaces.js';
export declare class EAttributeImpl extends EStructuralFeatureImpl implements EAttribute {
    private static _eStaticClass;
    static setStaticClass(cls: EClass): void;
    eClass(): EClass;
    protected _iD: boolean;
    constructor(init?: Partial<EAttribute>);
    get iD(): boolean;
    set iD(value: boolean);
    /**
     * DERIVED — el tipo de dato (EDataType) de este atributo.
     * Si eType es un EDataType, lo devuelve directamente.
     */
    get eAttributeType(): EDataType;
}
//# sourceMappingURL=EAttributeImpl.d.ts.map