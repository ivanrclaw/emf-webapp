/**
 * @emf-webapp/core — NotificationImpl & AdapterImpl
 *
 * Implementaciones completas de Notification y Adapter
 * conforme a EMF 2.45.0.
 *
 * NotificationImpl:
 * - Almacena eventType, notifier, featureID, oldValue, newValue, position
 * - Soporta isTouch (cuando old === new o ambos null)
 * - merge() combina notificaciones compatibles
 *
 * AdapterImpl:
 * - Implementación base de Adapter con target y notifyChanged
 */
import type { Notification, Adapter, EObject, EStructuralFeature, EClass } from './interfaces.js';
export declare class NotificationImpl implements Notification {
    /** Tipo de evento (SET=1, UNSET=2, ADD=3, REMOVE=4, ADD_MANY=5, REMOVE_MANY=6, MOVE=7) */
    private _eventType;
    /** Objeto que notifica (el notifier, dueño del cambio) */
    private _notifier;
    /** Feature ID dentro de la EClass del notifier */
    private _featureID;
    /** Feature estructural (resuelto desde featureID bajo demanda) */
    private _feature;
    /** Valor anterior */
    private _oldValue;
    /** Valor nuevo */
    private _newValue;
    /** Posición (para listas: índice del cambio; -1 si no aplica) */
    private _position;
    /** True si es un "touch" (old === new, sin cambio real) */
    private _isTouch;
    constructor(eventType: number, notifier: any, featureID: number, oldValue: any, newValue: any, position?: number);
    getNotifier(): any;
    getFeature(): EStructuralFeature | null;
    getFeatureID(expectedClass: EClass): number;
    getOldValue(): any;
    getNewValue(): any;
    getEventType(): number;
    getPosition(): number;
    isTouch(): boolean;
    /**
     * Intenta fusionar otra notificación con esta.
     *
     * En EMF, dos notificaciones se fusionan si:
     * - Mismo notifier, featureID y eventType
     * - oldValue / newValue son compatibles (ej: SET sobre SET reemplaza newValue)
     *
     * @returns true si se fusionó exitosamente
     */
    merge(notification: Notification): boolean;
    toString(): string;
}
/**
 * Implementación base de Adapter.
 *
 * Las subclases extienden AdapterImpl y sobreescriben
 * notifyChanged() para reaccionar a cambios en el modelo.
 */
export declare class AdapterImpl implements Adapter {
    /** El EObject al que está adaptado */
    private _target;
    constructor(target?: EObject | null);
    getTarget(): EObject | null;
    setTarget(newTarget: EObject): void;
    /**
     * Método llamado cuando el target notifica un cambio.
     * Sobrescribir en subclases para reaccionar a notificaciones.
     */
    notifyChanged(notification: Notification): void;
    /**
     * Determina si este adaptador es aplicable al tipo dado.
     * Sobrescribir en subclases.
     */
    isAdapterForType(type: any): boolean;
}
/**
 * Crea una notificación SET (event type 1).
 */
export declare function createSetNotification(notifier: any, featureID: number, oldValue: any, newValue: any): NotificationImpl;
/**
 * Crea una notificación UNSET (event type 2).
 */
export declare function createUnsetNotification(notifier: any, featureID: number, oldValue: any, newValue: any): NotificationImpl;
/**
 * Crea una notificación ADD (event type 3).
 */
export declare function createAddNotification(notifier: any, featureID: number, newValue: any, position: number): NotificationImpl;
/**
 * Crea una notificación REMOVE (event type 4).
 */
export declare function createRemoveNotification(notifier: any, featureID: number, oldValue: any, position: number): NotificationImpl;
/**
 * Crea una notificación ADD_MANY (event type 5).
 */
export declare function createAddManyNotification(notifier: any, featureID: number, newValues: any[], position: number): NotificationImpl;
/**
 * Crea una notificación REMOVE_MANY (event type 6).
 */
export declare function createRemoveManyNotification(notifier: any, featureID: number, oldValues: any[], position: number): NotificationImpl;
/**
 * Crea una notificación MOVE (event type 7).
 */
export declare function createMoveNotification(notifier: any, featureID: number, movedElement: any, newPosition: number): NotificationImpl;
//# sourceMappingURL=NotificationImpl.d.ts.map