/**
 * @emf-webapp/core — ETypedElementImpl
 *
 * Implementación base de ETypedElement.
 * Añade soporte para tipo, cardinalidad, ordered, unique.
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { ETypedElement, EClassifier, EGenericType } from './interfaces.js';
export declare abstract class ETypedElementImpl extends ENamedElementImpl implements ETypedElement {
    protected _ordered: boolean;
    protected _unique: boolean;
    protected _lowerBound: number;
    protected _upperBound: number;
    protected _eType: EClassifier | null;
    protected _eGenericType: EGenericType | null;
    get ordered(): boolean;
    set ordered(value: boolean);
    get unique(): boolean;
    set unique(value: boolean);
    get lowerBound(): number;
    set lowerBound(value: number);
    get upperBound(): number;
    set upperBound(value: number);
    /** DERIVED: upperBound < 0 || upperBound > 1 */
    get many(): boolean;
    /** DERIVED: lowerBound > 0 */
    get required(): boolean;
    get eType(): EClassifier | null;
    set eType(value: EClassifier | null);
    get eGenericType(): EGenericType | null;
    set eGenericType(value: EGenericType | null);
}
//# sourceMappingURL=ETypedElementImpl.d.ts.map