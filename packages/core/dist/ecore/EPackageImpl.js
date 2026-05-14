/**
 * @emf-webapp/core — EPackageImpl
 *
 * Implementación de EPackage con eClassifiers, eSubpackages,
 * eFactoryInstance, getEClassifier(name).
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import { EFactoryImpl } from './EFactoryImpl.js';
import { EListImpl } from '../util/EList.js';
export class EPackageImpl extends ENamedElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _nsURI = '';
    _nsPrefix = '';
    /** Clasificadores contenidos (containment) */
    _eClassifiers = new EListImpl({
        unique: true,
        notifier: this,
    });
    /** Subpaquetes (containment) */
    _eSubpackages = new EListImpl({
        unique: true,
        notifier: this,
    });
    /** Super paquete */
    _eSuperPackage = null;
    /** Fábrica asociada (containment) */
    _eFactoryInstance = null;
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    get nsURI() {
        return this._nsURI;
    }
    set nsURI(value) {
        const old = this._nsURI;
        this._nsURI = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get nsPrefix() {
        return this._nsPrefix;
    }
    set nsPrefix(value) {
        const old = this._nsPrefix;
        this._nsPrefix = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get eClassifiers() {
        return this._eClassifiers;
    }
    set eClassifiers(value) {
        this._eClassifiers.clear();
        for (const c of value) {
            this._eClassifiers.add(c);
            // Establecer el contenedor del clasificador
            if ('ePackage' in c) {
                c.ePackage = this;
            }
        }
    }
    get eSubpackages() {
        return this._eSubpackages;
    }
    set eSubpackages(value) {
        this._eSubpackages.clear();
        for (const pkg of value) {
            this._eSubpackages.add(pkg);
            // Establecer el contenedor del subpaquete
            pkg._eSuperPackage = this;
        }
    }
    /** DERIVED, transient */
    get eSuperPackage() {
        return this._eSuperPackage;
    }
    get eFactoryInstance() {
        if (this._eFactoryInstance === null) {
            // Crear fábrica por defecto
            this._eFactoryInstance = new EFactoryImpl();
            this._eFactoryInstance.ePackage = this;
        }
        return this._eFactoryInstance;
    }
    set eFactoryInstance(value) {
        this._eFactoryInstance = value;
        if (value) {
            value.ePackage = this;
        }
    }
    // ==========================================================
    // Métodos
    // ==========================================================
    /**
     * Busca un clasificador por nombre.
     */
    getEClassifier(name) {
        for (const c of this._eClassifiers) {
            if (c.name === name) {
                return c;
            }
        }
        return null;
    }
    toString() {
        return `${this._name} (nsURI: ${this._nsURI}, nsPrefix: ${this._nsPrefix})`;
    }
}
//# sourceMappingURL=EPackageImpl.js.map