/**
 * @emf-webapp/core — EEnumImpl + EEnumLiteralImpl
 *
 * Implementación de EEnum con eLiterals y métodos de búsqueda.
 * Implementación de EEnumLiteral con value, literal, instance.
 */
import { EDataTypeImpl } from './EDataTypeImpl.js';
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { EEnum, EEnumLiteral } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare class EEnumLiteralImpl extends ENamedElementImpl implements EEnumLiteral {
    protected _value: number;
    protected _literal: string;
    protected _eEnum: EEnum | null;
    get value(): number;
    set value(value: number);
    get literal(): string;
    set literal(value: string);
    /**
     * DERIVED — la instancia del literal (el literal mismo).
     */
    get instance(): any;
    /** Container */
    get eEnum(): EEnum;
    set eEnum(value: EEnum);
    toString(): string;
}
export declare class EEnumImpl extends EDataTypeImpl implements EEnum {
    /** Lista de literales (containment) */
    protected _eLiterals: EListImpl<EEnumLiteral>;
    get eLiterals(): EEnumLiteral[];
    set eLiterals(value: EEnumLiteral[]);
    /** Serialización: false para enums (no serializables como cadena simple) */
    get serializable(): boolean;
    set serializable(value: boolean);
    /**
     * Busca un literal por nombre.
     */
    getEEnumLiteral(name: string): EEnumLiteral | null;
    /**
     * Busca un literal por valor numérico.
     */
    getEEnumLiteral(value: number): EEnumLiteral | null;
    /**
     * Busca un literal por su string literal.
     */
    getEEnumLiteral(literal: string): EEnumLiteral | null;
    /**
     * Override: los EEnum retornan un classifierID específico.
     */
    getClassifierID(): number;
    toString(): string;
}
//# sourceMappingURL=EEnumImpl.d.ts.map