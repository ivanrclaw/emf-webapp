/**
 * @emf-webapp/core — ENamedElementImpl
 *
 * Implementación base de ENamedElement.
 * Añade la propiedad name.
 */
import { EModelElementImpl } from './EModelElementImpl.js';
import type { ENamedElement } from './interfaces.js';
export declare abstract class ENamedElementImpl extends EModelElementImpl implements ENamedElement {
    protected _name: string;
    constructor(name?: string);
    get name(): string;
    set name(value: string);
}
//# sourceMappingURL=ENamedElementImpl.d.ts.map