/**
 * @emf-webapp/core — EAnnotationImpl
 *
 * Implementación de EAnnotation con source, details, contents, references.
 */
import { EModelElementImpl } from './EModelElementImpl.js';
import type { EAnnotation, EObject, EModelElement, EClass, EList } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare class EAnnotationImpl extends EModelElementImpl implements EAnnotation {
    private static _eStaticClass;
    static setStaticClass(cls: EClass): void;
    eClass(): EClass;
    protected _source: string;
    protected _details: Record<string, string>;
    protected _eModelElement: EModelElement | null;
    /** Contenidos (EObjects contenidos) — containment */
    protected _contents: EListImpl<EObject>;
    /** Referencias a otros EObjects — no containment */
    protected _references: EListImpl<EObject>;
    get source(): string;
    set source(value: string);
    get details(): Record<string, string>;
    set details(value: Record<string, string>);
    get contents(): EList<EObject>;
    set contents(value: EList<EObject>);
    get references(): EList<EObject>;
    set references(value: EList<EObject>);
    /** Container (transient) */
    get eModelElement(): EModelElement | null;
    set eModelElement(value: EModelElement | null);
}
//# sourceMappingURL=EAnnotationImpl.d.ts.map