/**
 * @emf-webapp/core — EAnnotationImpl
 *
 * Implementación de EAnnotation con source, details, contents, references.
 */
import { EModelElementImpl } from './EModelElementImpl.js';
import { EListImpl } from '../util/EList.js';
export class EAnnotationImpl extends EModelElementImpl {
    // ==========================================================
    // Metaclass
    // ==========================================================
    static _eStaticClass = null;
    static setStaticClass(cls) {
        EAnnotationImpl._eStaticClass = cls;
    }
    eClass() {
        if (EAnnotationImpl._eStaticClass === null) {
            throw new Error('EAnnotationImpl.eClass() not initialized');
        }
        return EAnnotationImpl._eStaticClass;
    }
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _source = '';
    _details = {};
    _eModelElement = null;
    /** Contenidos (EObjects contenidos) — containment */
    _contents = new EListImpl({
        unique: false,
        notifier: this,
    });
    /** Referencias a otros EObjects — no containment */
    _references = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get source() {
        return this._source;
    }
    set source(value) {
        const old = this._source;
        this._source = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get details() {
        return this._details;
    }
    set details(value) {
        const old = this._details;
        this._details = { ...value };
        this.fireNotification(1, -1, old, value, -1);
    }
    get contents() {
        return this._contents;
    }
    set contents(value) {
        this._contents.clear();
        for (const obj of value) {
            this._contents.add(obj);
        }
    }
    get references() {
        return this._references;
    }
    set references(value) {
        this._references.clear();
        for (const obj of value) {
            this._references.add(obj);
        }
    }
    /** Container (transient) */
    get eModelElement() {
        return this._eModelElement;
    }
    set eModelElement(value) {
        this._eModelElement = value;
    }
}
//# sourceMappingURL=EAnnotationImpl.js.map