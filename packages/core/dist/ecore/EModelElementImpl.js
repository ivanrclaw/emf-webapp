/**
 * @emf-webapp/core — EModelElementImpl
 *
 * Implementación base de EModelElement.
 * Añade soporte para anotaciones (eAnnotations).
 */
import { EObjectImpl } from './EObjectImpl.js';
import { EListImpl } from '../util/EList.js';
export class EModelElementImpl extends EObjectImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    /** Lista de anotaciones (containment) */
    _eAnnotations = new EListImpl({
        unique: false,
        notifier: this,
    });
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get eAnnotations() {
        return this._eAnnotations;
    }
    set eAnnotations(value) {
        this._eAnnotations.clear();
        for (let i = 0; i < value.size(); i++) {
            this._eAnnotations.add(value.get(i));
        }
    }
    getEAnnotation(source) {
        const arr = this._eAnnotations;
        for (let i = 0; i < arr.size(); i++) {
            const ann = arr.get(i);
            if (ann.source === source) {
                return ann;
            }
        }
        return null;
    }
}
//# sourceMappingURL=EModelElementImpl.js.map