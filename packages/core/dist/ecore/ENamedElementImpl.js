/**
 * @emf-webapp/core — ENamedElementImpl
 *
 * Implementación base de ENamedElement.
 * Añade la propiedad name.
 */
import { EModelElementImpl } from './EModelElementImpl.js';
export class ENamedElementImpl extends EModelElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _name = '';
    // ==========================================================
    // Constructor
    // ==========================================================
    constructor(name) {
        super();
        if (name !== undefined) {
            this._name = name;
        }
    }
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get name() {
        return this._name;
    }
    set name(value) {
        const oldValue = this._name;
        this._name = value;
        // Notificar cambio
        this.fireNotification(1, -1, oldValue, value, -1);
    }
}
//# sourceMappingURL=ENamedElementImpl.js.map