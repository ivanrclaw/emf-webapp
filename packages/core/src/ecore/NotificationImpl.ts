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

import type {
  Notification,
  Adapter,
  EObject,
  EStructuralFeature,
  EClass,
} from './interfaces.js';

// ============================================================
// NotificationImpl
// ============================================================

export class NotificationImpl implements Notification {
  /** Tipo de evento (SET=1, UNSET=2, ADD=3, REMOVE=4, ADD_MANY=5, REMOVE_MANY=6, MOVE=7) */
  private _eventType: number;

  /** Objeto que notifica (el notifier, dueño del cambio) */
  private _notifier: any;

  /** Feature ID dentro de la EClass del notifier */
  private _featureID: number;

  /** Feature estructural (resuelto desde featureID bajo demanda) */
  private _feature: EStructuralFeature | null;

  /** Valor anterior */
  private _oldValue: any;

  /** Valor nuevo */
  private _newValue: any;

  /** Posición (para listas: índice del cambio; -1 si no aplica) */
  private _position: number;

  /** True si es un "touch" (old === new, sin cambio real) */
  private _isTouch: boolean;

  constructor(
    eventType: number,
    notifier: any,
    featureID: number,
    oldValue: any,
    newValue: any,
    position: number = -1
  ) {
    this._eventType = eventType;
    this._notifier = notifier;
    this._featureID = featureID;
    this._feature = null; // lazy resolve
    this._oldValue = oldValue;
    this._newValue = newValue;
    this._position = position;
    // Touch detection: old === new (both null, undefined, or identical refs)
    this._isTouch = oldValue === newValue;
  }

  // ==========================================================
  // API Notification
  // ==========================================================

  getNotifier(): any {
    return this._notifier;
  }

  getFeature(): EStructuralFeature | null {
    // Lazy resolve from featureID if we have a notifier with eClass
    if (this._feature === null && this._featureID >= 0 && this._notifier) {
      const notifierObj = this._notifier as any;
      if (typeof notifierObj.eClass === 'function') {
        const eClass: EClass = notifierObj.eClass();
        if (eClass && typeof eClass.getEStructuralFeature === 'function') {
          this._feature = eClass.getEStructuralFeature(this._featureID);
        }
      }
    }
    return this._feature;
  }

  getFeatureID(expectedClass: EClass): number {
    return this._featureID;
  }

  getOldValue(): any {
    return this._oldValue;
  }

  getNewValue(): any {
    return this._newValue;
  }

  getEventType(): number {
    return this._eventType;
  }

  getPosition(): number {
    return this._position;
  }

  isTouch(): boolean {
    return this._isTouch;
  }

  /**
   * Intenta fusionar otra notificación con esta.
   *
   * En EMF, dos notificaciones se fusionan si:
   * - Mismo notifier, featureID y eventType
   * - oldValue / newValue son compatibles (ej: SET sobre SET reemplaza newValue)
   *
   * @returns true si se fusionó exitosamente
   */
  merge(notification: Notification): boolean {
    if (
      notification.getNotifier() !== this._notifier ||
      this._featureID < 0 ||
      notification.getFeatureID(
        (this._notifier as any)?.eClass?.() ?? ({} as EClass)
      ) !== this._featureID
    ) {
      return false;
    }

    const otherEvent = notification.getEventType();
    const otherOld = notification.getOldValue();
    const otherNew = notification.getNewValue();
    const otherPos = notification.getPosition();

    switch (this._eventType) {
      case 1: // SET — merge SET + SET
        if (otherEvent === 1) {
          // Si la otra notificación tiene el mismo oldValue que nuestro
          // newValue, podemos encadenar: actualizamos newValue
          if (otherOld === this._newValue) {
            this._newValue = otherNew;
            this._position = otherPos;
            this._isTouch = this._oldValue === this._newValue;
            return true;
          }
        }
        return false;

      case 3: // ADD — merge ADD + REMOVE (cancela)
        if (otherEvent === 4 && otherOld === this._newValue) {
          // ADD + REMOVE del mismo elemento = no-op
          this._eventType = 1; // SET with old === new (touch)
          this._oldValue = null;
          this._newValue = null;
          this._position = -1;
          this._isTouch = true;
          return true;
        }
        return false;

      case 4: // REMOVE — merge REMOVE + ADD (cancela o se convierte en MOVE)
        if (otherEvent === 3 && otherNew === this._oldValue) {
          // REMOVE + ADD del mismo elemento: podría ser MOVE
          this._eventType = 7; // MOVE
          this._oldValue = this._oldValue;
          this._newValue = this._oldValue;
          this._position = otherPos;
          this._isTouch = false;
          return true;
        }
        return false;

      case 5: // ADD_MANY
        if (otherEvent === 4) {
          // ADD_MANY + REMOVE de un elemento individual
          // Marcar como no-op si era parte de ADD_MANY
          return false; // No fusionamos — las listas EMF no suelen hacer esto
        }
        return false;

      default:
        return false;
    }
  }

  // ==========================================================
  // Utilidades
  // ==========================================================

  toString(): string {
    const typeNames: Record<number, string> = {
      1: 'SET',
      2: 'UNSET',
      3: 'ADD',
      4: 'REMOVE',
      5: 'ADD_MANY',
      6: 'REMOVE_MANY',
      7: 'MOVE',
    };
    return (
      `NotificationImpl(${typeNames[this._eventType] ?? this._eventType})` +
      ` { featureID: ${this._featureID}` +
      `, old: ${this._oldValue}` +
      `, new: ${this._newValue}` +
      `, pos: ${this._position}` +
      `, touch: ${this._isTouch} }`
    );
  }
}

// ============================================================
// AdapterImpl
// ============================================================

/**
 * Implementación base de Adapter.
 *
 * Las subclases extienden AdapterImpl y sobreescriben
 * notifyChanged() para reaccionar a cambios en el modelo.
 */
export class AdapterImpl implements Adapter {
  /** El EObject al que está adaptado */
  private _target: EObject | null = null;

  constructor(target?: EObject | null) {
    this._target = target ?? null;
  }

  getTarget(): EObject | null {
    return this._target;
  }

  setTarget(newTarget: EObject): void {
    this._target = newTarget;
  }

  /**
   * Método llamado cuando el target notifica un cambio.
   * Sobrescribir en subclases para reaccionar a notificaciones.
   */
  notifyChanged(notification: Notification): void {
    // Template method — subclases sobreescriben
  }

  /**
   * Determina si este adaptador es aplicable al tipo dado.
   * Sobrescribir en subclases.
   */
  isAdapterForType(type: any): boolean {
    return false;
  }
}

// ============================================================
// Funciones auxiliares para el sistema de notificaciones
// ============================================================

/**
 * Crea una notificación SET (event type 1).
 */
export function createSetNotification(
  notifier: any,
  featureID: number,
  oldValue: any,
  newValue: any
): NotificationImpl {
  return new NotificationImpl(1, notifier, featureID, oldValue, newValue, -1);
}

/**
 * Crea una notificación UNSET (event type 2).
 */
export function createUnsetNotification(
  notifier: any,
  featureID: number,
  oldValue: any,
  newValue: any
): NotificationImpl {
  return new NotificationImpl(2, notifier, featureID, oldValue, newValue, -1);
}

/**
 * Crea una notificación ADD (event type 3).
 */
export function createAddNotification(
  notifier: any,
  featureID: number,
  newValue: any,
  position: number
): NotificationImpl {
  return new NotificationImpl(3, notifier, featureID, null, newValue, position);
}

/**
 * Crea una notificación REMOVE (event type 4).
 */
export function createRemoveNotification(
  notifier: any,
  featureID: number,
  oldValue: any,
  position: number
): NotificationImpl {
  return new NotificationImpl(4, notifier, featureID, oldValue, null, position);
}

/**
 * Crea una notificación ADD_MANY (event type 5).
 */
export function createAddManyNotification(
  notifier: any,
  featureID: number,
  newValues: any[],
  position: number
): NotificationImpl {
  return new NotificationImpl(5, notifier, featureID, null, newValues, position);
}

/**
 * Crea una notificación REMOVE_MANY (event type 6).
 */
export function createRemoveManyNotification(
  notifier: any,
  featureID: number,
  oldValues: any[],
  position: number
): NotificationImpl {
  return new NotificationImpl(6, notifier, featureID, oldValues, null, position);
}

/**
 * Crea una notificación MOVE (event type 7).
 */
export function createMoveNotification(
  notifier: any,
  featureID: number,
  movedElement: any,
  newPosition: number
): NotificationImpl {
  return new NotificationImpl(
    7,
    notifier,
    featureID,
    movedElement,
    movedElement,
    newPosition
  );
}
