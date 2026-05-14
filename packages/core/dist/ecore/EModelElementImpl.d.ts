/**
 * @emf-webapp/core — EModelElementImpl
 *
 * Implementación base de EModelElement.
 * Añade soporte para anotaciones (eAnnotations).
 */
import { EObjectImpl } from './EObjectImpl.js';
import type { EModelElement, EAnnotation, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare abstract class EModelElementImpl extends EObjectImpl implements EModelElement {
    /** Lista de anotaciones (containment) */
    protected _eAnnotations: EListImpl<EAnnotation>;
    get eAnnotations(): EList<EAnnotation>;
    set eAnnotations(value: EList<EAnnotation>);
    getEAnnotation(source: string): EAnnotation | null;
}
//# sourceMappingURL=EModelElementImpl.d.ts.map