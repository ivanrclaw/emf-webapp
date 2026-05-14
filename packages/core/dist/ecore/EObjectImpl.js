/**
 * @emf-webapp/core — EObjectImpl
 *
 * Implementación base de EObject con soporte completo para:
 * - API reflexiva (eGet, eSet, eIsSet, eUnset)
 * - Container tracking (eContainer, eContainingFeature, eContainmentFeature)
 * - Navegación (eContents, eAllContents, eCrossReferences)
 * - Notifier (eAdapters, eDeliver, eSetDeliver, eNotify)
 * - Recursos (eResource)
 * - Proxy (eIsProxy)
 * - Invocación de operaciones (eInvoke)
 *
 * Las subclases concretas pueden usar _initStaticClass(EClass) en su constructor
 * para registrar su metaclase, o implementar eClass() directamente.
 */
import { NotificationImpl } from './NotificationImpl.js';
import { EListImpl } from '../util/EList.js';
// Constantes de EventType (coinciden con el const enum en interfaces.ts)
const SET = 1;
const UNSET = 2;
const ADD = 3;
const REMOVE = 4;
const ADD_MANY = 5;
const REMOVE_MANY = 6;
const MOVE = 7;
// ============================================================
// EObjectImpl
// ============================================================
export class EObjectImpl {
    // ==========================================================
    // Miembros privados de almacenamiento
    // ==========================================================
    /** Contenedor (quien me contiene por una referencia de containment) */
    _eContainer = null;
    /** Feature del contenedor que me contiene */
    _eContainingFeature = null;
    /** Recurso al que pertenezco */
    _eResource = null;
    /** Marca de proxy (objeto no resuelto) */
    _eIsProxy = false;
    /** Adaptadores registrados */
    _eAdapters = [];
    /** Flag de entrega de notificaciones */
    _eDeliver = true;
    /**
     * Almacenamiento de valores de features.
     * Key: featureID (number) — obtenido de eClass().getFeatureID(feature).
     * Value: valor del feature (primitivo, objeto, EList, etc.).
     */
    _featureValues = new Map();
    /**
     * Conjunto de featureIDs que han sido explícitamente asignados (set).
     * Usado por eIsSet / eUnset para features unsettable.
     */
    _isSet = new Set();
    /**
     * Caché de listas EList para features multi-valued.
     * Key: featureID. Value: EListImpl para ese feature.
     */
    _lists = new Map();
    /**
     * Clase estática (metaclass) para este tipo de objeto.
     * Cada subclase concreta debe llamar a _initStaticClass() en su constructor
     * o vía setStaticClass() estático para registrar su EClass.
     */
    _eStaticClass = null;
    /**
     * Registra la EClass estática para esta clase concreta.
     * Debe llamarse desde el constructor de cada subclase.
     */
    _initStaticClass(eClass) {
        this._eStaticClass = eClass;
    }
    // ==========================================================
    // eClass() — implementación por defecto
    // ==========================================================
    eClass() {
        if (this._eStaticClass === null) {
            throw new Error(`${this.constructor.name}.eClass() not initialized — call _initStaticClass() in constructor or implement eClass()`);
        }
        return this._eStaticClass;
    }
    // ==========================================================
    // Container tracking
    // ==========================================================
    eContainer() {
        return this._eContainer;
    }
    eContainingFeature() {
        return this._eContainingFeature;
    }
    eContainmentFeature() {
        if (this._eContainingFeature !== null &&
            'containment' in this._eContainingFeature) {
            return this._eContainingFeature;
        }
        return null;
    }
    /**
     * Establece el contenedor de este objeto.
     * Usado internamente por el sistema de containment.
     */
    eSetContainer(newContainer, feature) {
        const oldContainer = this._eContainer;
        const oldFeature = this._eContainingFeature;
        this._eContainer = newContainer;
        this._eContainingFeature = feature;
        // Si cambió de contenedor, propagar el recurso
        if (oldContainer !== newContainer) {
            this.propagateResource(newContainer);
        }
    }
    /**
     * Limpia el contenedor de este objeto.
     * Usado cuando se remueve de una referencia de containment.
     */
    eUnsetContainer() {
        const oldContainer = this._eContainer;
        this._eContainer = null;
        this._eContainingFeature = null;
        if (oldContainer !== null) {
            this._eResource = null;
        }
    }
    // ==========================================================
    // Recurso
    // ==========================================================
    eResource() {
        // Si tengo recurso directo, devolverlo
        if (this._eResource !== null) {
            return this._eResource;
        }
        // Si tengo contenedor, delegar al contenedor
        if (this._eContainer !== null) {
            return this._eContainer.eResource();
        }
        return null;
    }
    /**
     * Asigna un recurso directamente a este objeto.
     */
    eSetResource(resource) {
        this._eResource = resource;
    }
    // ==========================================================
    // Proxy
    // ==========================================================
    eIsProxy() {
        return this._eIsProxy;
    }
    eSetProxy(isProxy) {
        this._eIsProxy = isProxy;
    }
    // ==========================================================
    // API Reflexiva
    // ==========================================================
    /**
     * Obtiene el valor de un feature estructural.
     */
    eGet(feature, resolve) {
        const featureID = this.getFeatureID(feature);
        const many = feature.many;
        if (many) {
            // Multi-valued: devolver la EList cacheada
            return this.getEList(feature, featureID);
        }
        // Single-valued
        if (this._featureValues.has(featureID)) {
            return this._featureValues.get(featureID);
        }
        // Valor por defecto
        return feature.defaultValue;
    }
    /**
     * Establece el valor de un feature estructural.
     */
    eSet(feature, value) {
        if (!feature.changeable) {
            throw new Error(`Feature ${feature.name} is not changeable`);
        }
        const featureID = this.getFeatureID(feature);
        const many = feature.many;
        const isContainment = 'containment' in feature ? feature.containment : false;
        if (many) {
            // Multi-valued: poblar la EList
            const list = this.getEList(feature, featureID);
            list.clear();
            if (Array.isArray(value)) {
                list.addAll(value);
            }
            else if (value !== null && value !== undefined) {
                list.add(value);
            }
            return;
        }
        // Single-valued
        const oldValue = this.eGet(feature);
        // Manejamos containment: desconectar el viejo, conectar el nuevo
        if (isContainment) {
            if (oldValue instanceof EObjectImpl) {
                oldValue.eUnsetContainer();
            }
            if (value instanceof EObjectImpl) {
                value.eSetContainer(this, feature);
            }
        }
        this._featureValues.set(featureID, value);
        this._isSet.add(featureID);
        this.fireNotification(SET, featureID, oldValue, value, -1);
    }
    /**
     * Verifica si un feature está establecido (set).
     */
    eIsSet(feature) {
        const featureID = this.getFeatureID(feature);
        const many = feature.many;
        if (many) {
            // Multi-valued: está seteado si la lista no está vacía
            const list = this._lists.get(featureID);
            if (list) {
                return !list.isEmpty();
            }
            return false;
        }
        // Unsettable support
        if (feature.unsettable) {
            return this._isSet.has(featureID);
        }
        // Para features no-unsettable: verificar si hay valor
        return (this._featureValues.has(featureID) ||
            this._isSet.has(featureID));
    }
    /**
     * Resetea un feature a su valor por defecto.
     */
    eUnset(feature) {
        const featureID = this.getFeatureID(feature);
        const many = feature.many;
        if (many) {
            // Multi-valued: limpiar la lista
            const list = this._lists.get(featureID);
            if (list) {
                list.clear();
            }
            return;
        }
        const oldValue = this.eGet(feature);
        const defaultValue = feature.defaultValue;
        // Manejamos containment: desconectar si aplica
        if ('containment' in feature &&
            feature.containment &&
            oldValue instanceof EObjectImpl) {
            oldValue.eUnsetContainer();
        }
        if (feature.unsettable) {
            this._isSet.delete(featureID);
            this._featureValues.delete(featureID);
        }
        else {
            this._featureValues.set(featureID, defaultValue);
            this._isSet.delete(featureID);
        }
        this.fireNotification(UNSET, featureID, oldValue, defaultValue, -1);
    }
    // ==========================================================
    // Navegación: Hijos y referencias
    // ==========================================================
    /**
     * Devuelve los hijos directos (objetos contenidos por referencias de containment).
     */
    eContents() {
        const eClass = this.eClass();
        // Usamos eAllStructuralFeatures (o eStructuralFeatures si no está disponible)
        const features = eClass.eAllStructuralFeatures ?? eClass.eStructuralFeatures;
        const result = [];
        for (const feature of features) {
            if (!('containment' in feature) || !feature.containment) {
                continue;
            }
            const ref = feature;
            const value = this.eGet(ref);
            if (ref.many) {
                for (const item of Array.from(value)) {
                    if (item instanceof EObjectImpl) {
                        result.push(item);
                    }
                }
            }
            else if (value instanceof EObjectImpl) {
                result.push(value);
            }
        }
        return result;
    }
    /**
     * Iterador recursivo de todos los descendientes.
     */
    eAllContents() {
        const self = this;
        const stack = [...self.eContents()];
        const iterator = {
            [Symbol.iterator]() {
                return iterator;
            },
            next() {
                if (stack.length === 0) {
                    return { done: true, value: undefined };
                }
                const current = stack.shift();
                if (current instanceof EObjectImpl) {
                    // Push children al inicio del stack (DFS pre-order)
                    stack.unshift(...current.eContents());
                }
                return { done: false, value: current };
            },
        };
        return iterator;
    }
    /**
     * Devuelve los objetos referenciados NO por containment (cross-references).
     */
    eCrossReferences() {
        const eClass = this.eClass();
        const features = eClass.eAllStructuralFeatures ?? eClass.eStructuralFeatures;
        const result = [];
        for (const feature of features) {
            if (!('containment' in feature)) {
                continue;
            }
            const ref = feature;
            // Solo nos interesan referencias NO containment y NO container
            if (ref.containment || ref.container) {
                continue;
            }
            const value = this.eGet(ref);
            if (ref.many) {
                for (const item of Array.from(value)) {
                    if (item instanceof EObjectImpl) {
                        result.push(item);
                    }
                }
            }
            else if (value instanceof EObjectImpl) {
                result.push(value);
            }
        }
        return result;
    }
    // ==========================================================
    // Invocación de operaciones
    // ==========================================================
    /**
     * Invoca una operación del modelo.
     *
     * Busca el método correspondiente en la instancia y lo llama.
     * Si no se encuentra, lanza un error.
     */
    eInvoke(operation, args) {
        const methodName = operation.name;
        // Intentar encontrar el método en el prototipo de la clase concreta
        const proto = Object.getPrototypeOf(this);
        const method = proto[methodName] ?? this[methodName];
        if (typeof method === 'function') {
            return method.apply(this, args ?? []);
        }
        throw new Error(`Operation '${methodName}' not implemented on ${this.constructor.name}`);
    }
    // ==========================================================
    // Notifier — eAdapters
    // ==========================================================
    eAdapters() {
        return this._eAdapters;
    }
    eDeliver() {
        return this._eDeliver;
    }
    eSetDeliver(deliver) {
        this._eDeliver = deliver;
    }
    /**
     * Añade un adaptador y lo registra.
     */
    eAdaptersAdd(adapter) {
        if (!this._eAdapters.includes(adapter)) {
            adapter.setTarget(this);
            this._eAdapters.push(adapter);
        }
    }
    /**
     * Elimina un adaptador.
     */
    eAdaptersRemove(adapter) {
        const idx = this._eAdapters.indexOf(adapter);
        if (idx >= 0) {
            this._eAdapters.splice(idx, 1);
            adapter.setTarget(null);
        }
    }
    /**
     * Notifica a todos los adaptadores registrados.
     */
    eNotify(notification) {
        if (!this._eDeliver) {
            return;
        }
        // Notificar a cada adaptador
        for (const adapter of this._eAdapters) {
            adapter.notifyChanged(notification);
        }
    }
    // ==========================================================
    // Métodos protegidos de ayuda
    // ==========================================================
    /**
     * Obtiene o crea la EList para un feature multi-valued.
     */
    getEList(feature, featureID) {
        let list = this._lists.get(featureID);
        if (!list) {
            const isContainment = 'containment' in feature
                ? feature.containment
                : false;
            list = new EListImpl({
                unique: feature.unique,
                notifier: this,
                feature: feature,
                featureID: featureID,
            });
            // Hook para containment tracking en listas
            // Se decoran los métodos de la lista para manejar containment
            if (isContainment) {
                this.decorateContainmentList(list, feature);
            }
            this._lists.set(featureID, list);
        }
        return list;
    }
    /**
     * Decora una EList para manejar containment automáticamente.
     * Cuando se añade un elemento a una lista de containment, se
     * establece su eContainer; cuando se remueve, se limpia.
     */
    decorateContainmentList(list, feature) {
        // Guardamos referencias a los métodos originales
        const origAdd = list.add.bind(list);
        const origAddAll = list.addAll.bind(list);
        const origRemove = list.remove.bind(list);
        const origRemoveAll = list.removeAll.bind(list);
        const origClear = list.clear.bind(list);
        const origSet = list.set.bind(list);
        const origBasicAdd = list.basicAdd.bind(list);
        const origMove = list.move.bind(list);
        // Sobrescribimos add (un solo arg)
        list.add = ((e) => {
            if (e instanceof EObjectImpl) {
                e.eSetContainer(this, feature);
            }
            return origAdd(e);
        });
        // Sobrescribimos add con índice
        const origAddWithIndex = list.add.bind(list);
        // Sobrescribimos basicAdd
        list.basicAdd = ((e) => {
            if (e instanceof EObjectImpl) {
                e.eSetContainer(this, feature);
            }
            origBasicAdd(e);
        });
        // Sobrescribimos remove
        const origSingleRemove = (e) => {
            if (e instanceof EObjectImpl) {
                e.eUnsetContainer();
            }
            return origRemove(e);
        };
        // Sobrescribimos para remove con índice también
        list.remove = ((indexOrE) => {
            let element;
            if (typeof indexOrE === 'number') {
                element = list.get(indexOrE);
                if (element instanceof EObjectImpl) {
                    element.eUnsetContainer();
                }
                return origRemove(indexOrE);
            }
            else {
                element = indexOrE;
                if (element instanceof EObjectImpl) {
                    element.eUnsetContainer();
                }
                return origRemove(element);
            }
        });
        // Sobrescribimos set
        list.set = ((index, e) => {
            const oldValue = list.get(index);
            if (oldValue instanceof EObjectImpl) {
                oldValue.eUnsetContainer();
            }
            if (e instanceof EObjectImpl) {
                e.eSetContainer(this, feature);
            }
            return origSet(index, e);
        });
        // Sobrescribimos clear
        list.clear = (() => {
            const arr = [...list];
            for (const item of arr) {
                if (item instanceof EObjectImpl) {
                    item.eUnsetContainer();
                }
            }
            origClear();
        });
        // Sobrescribimos removeAll
        list.removeAll = ((collection) => {
            for (const item of collection) {
                if (item instanceof EObjectImpl) {
                    item.eUnsetContainer();
                }
            }
            return origRemoveAll(collection);
        });
    }
    /**
     * Obtiene el featureID de un feature estructural.
     */
    getFeatureID(feature) {
        const eClass = this.eClass();
        if (typeof eClass.getFeatureID === 'function') {
            return eClass.getFeatureID(feature);
        }
        // Fallback: índice lineal en eStructuralFeatures
        const features = eClass.eStructuralFeatures;
        const idx = features.indexOf(feature);
        return idx >= 0 ? idx : -1;
    }
    /**
     * Dispara una notificación a los adaptadores.
     */
    fireNotification(eventType, featureID, oldValue, newValue, position) {
        if (!this._eDeliver) {
            return;
        }
        const notification = new NotificationImpl(eventType, this, featureID, oldValue, newValue, position);
        this.eNotify(notification);
    }
    /**
     * Propaga el recurso del contenedor a los hijos.
     */
    propagateResource(container) {
        const resource = container.eResource();
        this._eResource = resource;
    }
    // ==========================================================
    // Utilidades
    // ==========================================================
    /**
     * Limpia todos los estados internos (útil para pruebas).
     */
    eInternalClear() {
        this._featureValues.clear();
        this._isSet.clear();
        this._lists.clear();
        this._eAdapters = [];
        this._eContainer = null;
        this._eContainingFeature = null;
        this._eResource = null;
        this._eIsProxy = false;
        this._eDeliver = true;
    }
    toString() {
        const eClass = this.eClass();
        const className = eClass?.name ?? this.constructor.name;
        return `${className}@${this.id ?? Math.random().toString(36).slice(2, 8)}`;
    }
}
//# sourceMappingURL=EObjectImpl.js.map