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

import type {
  EObject,
  EClass,
  EStructuralFeature,
  EReference,
  EAttribute,
  EOperation,
  EParameter,
  Notifier,
  Adapter,
  Notification,
  Resource,
  EList,
} from './interfaces.js';
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

export abstract class EObjectImpl implements EObject {
  // ==========================================================
  // Miembros privados de almacenamiento
  // ==========================================================

  /** Contenedor (quien me contiene por una referencia de containment) */
  private _eContainer: EObject | null = null;

  /** Feature del contenedor que me contiene */
  private _eContainingFeature: EStructuralFeature | null = null;

  /** Recurso al que pertenezco */
  private _eResource: Resource | null = null;

  /** Marca de proxy (objeto no resuelto) */
  private _eIsProxy: boolean = false;

  /** Adaptadores registrados */
  private _eAdapters: Adapter[] = [];

  /** Flag de entrega de notificaciones */
  private _eDeliver: boolean = true;

  /**
   * Almacenamiento de valores de features.
   * Key: featureID (number) — obtenido de eClass().getFeatureID(feature).
   * Value: valor del feature (primitivo, objeto, EList, etc.).
   */
  protected _featureValues: Map<number, any> = new Map();

  /**
   * Conjunto de featureIDs que han sido explícitamente asignados (set).
   * Usado por eIsSet / eUnset para features unsettable.
   */
  protected _isSet: Set<number> = new Set();

  /**
   * Caché de listas EList para features multi-valued.
   * Key: featureID. Value: EListImpl para ese feature.
   */
  protected _lists: Map<number, EListImpl<any>> = new Map();

  /**
   * Clase estática (metaclass) para este tipo de objeto.
   * Cada subclase concreta debe llamar a _initStaticClass() en su constructor
   * o vía setStaticClass() estático para registrar su EClass.
   */
  protected _eStaticClass: EClass | null = null;

  /**
   * Registra la EClass estática para esta clase concreta.
   * Debe llamarse desde el constructor de cada subclase.
   */
  protected _initStaticClass(eClass: EClass): void {
    this._eStaticClass = eClass;
  }

  // ==========================================================
  // eClass() — implementación por defecto
  // ==========================================================

  eClass(): EClass {
    if (this._eStaticClass === null) {
      throw new Error(
        `${this.constructor.name}.eClass() not initialized — call _initStaticClass() in constructor or implement eClass()`
      );
    }
    return this._eStaticClass;
  }

  // ==========================================================
  // Container tracking
  // ==========================================================

  eContainer(): EObject | null {
    return this._eContainer;
  }

  eContainingFeature(): EStructuralFeature | null {
    return this._eContainingFeature;
  }

  eContainmentFeature(): EReference | null {
    if (
      this._eContainingFeature !== null &&
      'containment' in this._eContainingFeature
    ) {
      return this._eContainingFeature as EReference;
    }
    return null;
  }

  /**
   * Establece el contenedor de este objeto.
   * Usado internamente por el sistema de containment.
   */
  eSetContainer(
    newContainer: EObject,
    feature: EStructuralFeature
  ): void {
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
  eUnsetContainer(): void {
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

  eResource(): Resource | null {
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
  eSetResource(resource: Resource | null): void {
    this._eResource = resource;
  }

  // ==========================================================
  // Proxy
  // ==========================================================

  eIsProxy(): boolean {
    return this._eIsProxy;
  }

  eSetProxy(isProxy: boolean): void {
    this._eIsProxy = isProxy;
  }

  // ==========================================================
  // API Reflexiva
  // ==========================================================

  /**
   * Obtiene el valor de un feature estructural.
   */
  eGet(feature: EStructuralFeature, resolve?: boolean): any {
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
  eSet(feature: EStructuralFeature, value: any): void {
    if (!feature.changeable) {
      throw new Error(`Feature ${feature.name} is not changeable`);
    }

    const featureID = this.getFeatureID(feature);
    const many = feature.many;
    const isContainment =
      'containment' in feature ? (feature as EReference).containment : false;

    if (many) {
      // Multi-valued: poblar la EList
      const list = this.getEList(feature, featureID) as EListImpl<any>;
      list.clear();
      if (Array.isArray(value)) {
        list.addAll(value);
      } else if (value !== null && value !== undefined) {
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

    this.fireNotification(
      SET,
      featureID,
      oldValue,
      value,
      -1
    );
  }

  /**
   * Verifica si un feature está establecido (set).
   */
  eIsSet(feature: EStructuralFeature): boolean {
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
    return (
      this._featureValues.has(featureID) ||
      this._isSet.has(featureID)
    );
  }

  /**
   * Resetea un feature a su valor por defecto.
   */
  eUnset(feature: EStructuralFeature): void {
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
    if (
      'containment' in feature &&
      (feature as EReference).containment &&
      oldValue instanceof EObjectImpl
    ) {
      oldValue.eUnsetContainer();
    }

    if (feature.unsettable) {
      this._isSet.delete(featureID);
      this._featureValues.delete(featureID);
    } else {
      this._featureValues.set(featureID, defaultValue);
      this._isSet.delete(featureID);
    }

    this.fireNotification(
      UNSET,
      featureID,
      oldValue,
      defaultValue,
      -1
    );
  }

  // ==========================================================
  // Navegación: Hijos y referencias
  // ==========================================================

  /**
   * Devuelve los hijos directos (objetos contenidos por referencias de containment).
   */
  eContents(): EObject[] {
    const eClass = this.eClass();
    // Usamos eAllStructuralFeatures (o eStructuralFeatures si no está disponible)
    const features = eClass.eAllStructuralFeatures ?? eClass.eStructuralFeatures;
    const result: EObject[] = [];

    for (const feature of features) {
      if (!('containment' in feature) || !(feature as EReference).containment) {
        continue;
      }
      const ref = feature as EReference;
      const value = this.eGet(ref);

      if (ref.many) {
        for (const item of Array.from(value as EObject[])) {
          if (item instanceof EObjectImpl) {
            result.push(item);
          }
        }
      } else if (value instanceof EObjectImpl) {
        result.push(value);
      }
    }

    return result;
  }

  /**
   * Iterador recursivo de todos los descendientes.
   */
  eAllContents(): IterableIterator<EObject> {
    const self = this;
    const stack: EObject[] = [...self.eContents()];
    const iterator: IterableIterator<EObject> = {
      [Symbol.iterator](): IterableIterator<EObject> {
        return iterator;
      },
      next(): IteratorResult<EObject> {
        if (stack.length === 0) {
          return { done: true, value: undefined as any };
        }
        const current = stack.shift()!;
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
  eCrossReferences(): EObject[] {
    const eClass = this.eClass();
    const features =
      eClass.eAllStructuralFeatures ?? eClass.eStructuralFeatures;
    const result: EObject[] = [];

    for (const feature of features) {
      if (!('containment' in feature)) {
        continue;
      }
      const ref = feature as EReference;
      // Solo nos interesan referencias NO containment y NO container
      if (ref.containment || (ref as any).container) {
        continue;
      }

      const value = this.eGet(ref);
      if (ref.many) {
        for (const item of Array.from(value as EObject[])) {
          if (item instanceof EObjectImpl) {
            result.push(item);
          }
        }
      } else if (value instanceof EObjectImpl) {
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
  eInvoke(operation: EOperation, args: any[]): any {
    const methodName = operation.name;

    // Intentar encontrar el método en el prototipo de la clase concreta
    const proto = Object.getPrototypeOf(this);
    const method = (proto as any)[methodName] ?? (this as any)[methodName];

    if (typeof method === 'function') {
      return method.apply(this, args ?? []);
    }

    throw new Error(
      `Operation '${methodName}' not implemented on ${this.constructor.name}`
    );
  }

  // ==========================================================
  // Notifier — eAdapters
  // ==========================================================

  eAdapters(): Adapter[] {
    return this._eAdapters;
  }

  eDeliver(): boolean {
    return this._eDeliver;
  }

  eSetDeliver(deliver: boolean): void {
    this._eDeliver = deliver;
  }

  /**
   * Añade un adaptador y lo registra.
   */
  eAdaptersAdd(adapter: Adapter): void {
    if (!this._eAdapters.includes(adapter)) {
      adapter.setTarget(this);
      this._eAdapters.push(adapter);
    }
  }

  /**
   * Elimina un adaptador.
   */
  eAdaptersRemove(adapter: Adapter): void {
    const idx = this._eAdapters.indexOf(adapter);
    if (idx >= 0) {
      this._eAdapters.splice(idx, 1);
      adapter.setTarget(null!);
    }
  }

  /**
   * Notifica a todos los adaptadores registrados.
   */
  eNotify(notification: Notification): void {
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
  protected getEList(
    feature: EStructuralFeature,
    featureID: number
  ): EListImpl<any> {
    let list = this._lists.get(featureID);
    if (!list) {
      const isContainment =
        'containment' in feature
          ? (feature as EReference).containment
          : false;

      list = new EListImpl<any>({
        unique: feature.unique,
        notifier: this,
        feature: feature,
        featureID: featureID,
      });

      // Hook para containment tracking en listas
      // Se decoran los métodos de la lista para manejar containment
      if (isContainment) {
        this.decorateContainmentList(list, feature as EReference);
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
  private decorateContainmentList(
    list: EListImpl<any>,
    feature: EReference
  ): void {
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
    list.add = ((e: any): boolean => {
      if (e instanceof EObjectImpl) {
        e.eSetContainer(this, feature);
      }
      return (origAdd as (e: any) => boolean)(e);
    }) as typeof list.add;

    // Sobrescribimos add con índice
    const origAddWithIndex = list.add.bind(list);

    // Sobrescribimos basicAdd
    list.basicAdd = ((e: any): void => {
      if (e instanceof EObjectImpl) {
        e.eSetContainer(this, feature);
      }
      origBasicAdd(e);
    }) as typeof list.basicAdd;

    // Sobrescribimos remove
    const origSingleRemove = (e: any): boolean => {
      if (e instanceof EObjectImpl) {
        e.eUnsetContainer();
      }
      return (origRemove as (e: any) => boolean)(e);
    };

    // Sobrescribimos para remove con índice también
    list.remove = ((indexOrE: any): any => {
      let element: any;
      if (typeof indexOrE === 'number') {
        element = list.get(indexOrE);
        if (element instanceof EObjectImpl) {
          element.eUnsetContainer();
        }
        return (origRemove as (index: number) => any)(indexOrE);
      } else {
        element = indexOrE;
        if (element instanceof EObjectImpl) {
          element.eUnsetContainer();
        }
        return (origRemove as (e: any) => boolean)(element);
      }
    }) as typeof list.remove;

    // Sobrescribimos set
    list.set = ((index: number, e: any): any => {
      const oldValue = list.get(index);
      if (oldValue instanceof EObjectImpl) {
        oldValue.eUnsetContainer();
      }
      if (e instanceof EObjectImpl) {
        e.eSetContainer(this, feature);
      }
      return (origSet as (index: number, e: any) => any)(index, e);
    }) as typeof list.set;

    // Sobrescribimos clear
    list.clear = ((): void => {
      const arr = [...list];
      for (const item of arr) {
        if (item instanceof EObjectImpl) {
          item.eUnsetContainer();
        }
      }
      origClear();
    }) as typeof list.clear;

    // Sobrescribimos removeAll
    list.removeAll = ((collection: any[]): boolean => {
      for (const item of collection) {
        if (item instanceof EObjectImpl) {
          item.eUnsetContainer();
        }
      }
      return (origRemoveAll as (collection: any[]) => boolean)(collection);
    }) as typeof list.removeAll;
  }

  /**
   * Obtiene el featureID de un feature estructural.
   */
  protected getFeatureID(feature: EStructuralFeature): number {
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
  protected fireNotification(
    eventType: number,
    featureID: number,
    oldValue: any,
    newValue: any,
    position: number
  ): void {
    if (!this._eDeliver) {
      return;
    }

    const notification = new NotificationImpl(
      eventType,
      this,
      featureID,
      oldValue,
      newValue,
      position
    );

    this.eNotify(notification);
  }

  /**
   * Propaga el recurso del contenedor a los hijos.
   */
  private propagateResource(container: EObject): void {
    const resource = container.eResource();
    this._eResource = resource;
  }

  // ==========================================================
  // Utilidades
  // ==========================================================

  /**
   * Limpia todos los estados internos (útil para pruebas).
   */
  eInternalClear(): void {
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

  toString(): string {
    const eClass = this.eClass();
    const className = eClass?.name ?? this.constructor.name;
    return `${className}@${(this as any).id ?? Math.random().toString(36).slice(2, 8)}`;
  }
}
