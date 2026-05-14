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
import type { EObject, EClass, EStructuralFeature, EReference, EOperation, Adapter, Notification, Resource } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare abstract class EObjectImpl implements EObject {
    /** Contenedor (quien me contiene por una referencia de containment) */
    private _eContainer;
    /** Feature del contenedor que me contiene */
    private _eContainingFeature;
    /** Recurso al que pertenezco */
    private _eResource;
    /** Marca de proxy (objeto no resuelto) */
    private _eIsProxy;
    /** Adaptadores registrados */
    private _eAdapters;
    /** Flag de entrega de notificaciones */
    private _eDeliver;
    /**
     * Almacenamiento de valores de features.
     * Key: featureID (number) — obtenido de eClass().getFeatureID(feature).
     * Value: valor del feature (primitivo, objeto, EList, etc.).
     */
    protected _featureValues: Map<number, any>;
    /**
     * Conjunto de featureIDs que han sido explícitamente asignados (set).
     * Usado por eIsSet / eUnset para features unsettable.
     */
    protected _isSet: Set<number>;
    /**
     * Caché de listas EList para features multi-valued.
     * Key: featureID. Value: EListImpl para ese feature.
     */
    protected _lists: Map<number, EListImpl<any>>;
    /**
     * Clase estática (metaclass) para este tipo de objeto.
     * Cada subclase concreta debe llamar a _initStaticClass() en su constructor
     * o vía setStaticClass() estático para registrar su EClass.
     */
    protected _eStaticClass: EClass | null;
    /**
     * Registra la EClass estática para esta clase concreta.
     * Debe llamarse desde el constructor de cada subclase.
     */
    protected _initStaticClass(eClass: EClass): void;
    eClass(): EClass;
    eContainer(): EObject | null;
    eContainingFeature(): EStructuralFeature | null;
    eContainmentFeature(): EReference | null;
    /**
     * Establece el contenedor de este objeto.
     * Usado internamente por el sistema de containment.
     */
    eSetContainer(newContainer: EObject, feature: EStructuralFeature): void;
    /**
     * Limpia el contenedor de este objeto.
     * Usado cuando se remueve de una referencia de containment.
     */
    eUnsetContainer(): void;
    eResource(): Resource | null;
    /**
     * Asigna un recurso directamente a este objeto.
     */
    eSetResource(resource: Resource | null): void;
    eIsProxy(): boolean;
    eSetProxy(isProxy: boolean): void;
    /**
     * Obtiene el valor de un feature estructural.
     */
    eGet(feature: EStructuralFeature, resolve?: boolean): any;
    /**
     * Establece el valor de un feature estructural.
     */
    eSet(feature: EStructuralFeature, value: any): void;
    /**
     * Verifica si un feature está establecido (set).
     */
    eIsSet(feature: EStructuralFeature): boolean;
    /**
     * Resetea un feature a su valor por defecto.
     */
    eUnset(feature: EStructuralFeature): void;
    /**
     * Devuelve los hijos directos (objetos contenidos por referencias de containment).
     */
    eContents(): EObject[];
    /**
     * Iterador recursivo de todos los descendientes.
     */
    eAllContents(): IterableIterator<EObject>;
    /**
     * Devuelve los objetos referenciados NO por containment (cross-references).
     */
    eCrossReferences(): EObject[];
    /**
     * Invoca una operación del modelo.
     *
     * Busca el método correspondiente en la instancia y lo llama.
     * Si no se encuentra, lanza un error.
     */
    eInvoke(operation: EOperation, args: any[]): any;
    eAdapters(): Adapter[];
    eDeliver(): boolean;
    eSetDeliver(deliver: boolean): void;
    /**
     * Añade un adaptador y lo registra.
     */
    eAdaptersAdd(adapter: Adapter): void;
    /**
     * Elimina un adaptador.
     */
    eAdaptersRemove(adapter: Adapter): void;
    /**
     * Notifica a todos los adaptadores registrados.
     */
    eNotify(notification: Notification): void;
    /**
     * Obtiene o crea la EList para un feature multi-valued.
     */
    protected getEList(feature: EStructuralFeature, featureID: number): EListImpl<any>;
    /**
     * Decora una EList para manejar containment automáticamente.
     * Cuando se añade un elemento a una lista de containment, se
     * establece su eContainer; cuando se remueve, se limpia.
     */
    private decorateContainmentList;
    /**
     * Obtiene el featureID de un feature estructural.
     */
    protected getFeatureID(feature: EStructuralFeature): number;
    /**
     * Dispara una notificación a los adaptadores.
     */
    protected fireNotification(eventType: number, featureID: number, oldValue: any, newValue: any, position: number): void;
    /**
     * Propaga el recurso del contenedor a los hijos.
     */
    private propagateResource;
    /**
     * Limpia todos los estados internos (útil para pruebas).
     */
    eInternalClear(): void;
    toString(): string;
}
//# sourceMappingURL=EObjectImpl.d.ts.map