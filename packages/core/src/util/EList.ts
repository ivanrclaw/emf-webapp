/**
 * @emf-webapp/core — EListImpl
 *
 * Implementación completa de EList<T> heredando de Array<T>.
 * Esto la hace 100% compatible con T[] para TypeScript.
 *
 * Comportamiento EMF:
 * - unique=true: add(e) rechaza duplicados silenciosamente (return false),
 *   addUnique(e) lanza error.
 * - Cada mutación dispara una Notification al Notifier si eDeliver()=true.
 * - basicAdd añade sin notificaciones.
 * - move reordena elementos.
 */

import type {
  EList,
  Notifier,
  EStructuralFeature,
  Notification,
} from '../ecore/interfaces.js';
import { NotificationImpl } from '../ecore/NotificationImpl.js';

// Constantes de EventType
const SET = 1;
const UNSET = 2;
const ADD = 3;
const REMOVE = 4;
const ADD_MANY = 5;
const REMOVE_MANY = 6;
const MOVE = 7;

export class DuplicateException extends Error {
  constructor(message?: string) {
    super(message ?? 'Element already exists in unique list');
    this.name = 'DuplicateException';
  }
}

export class EListImpl<T> extends Array<T> implements EList<T> {
  private _unique: boolean;
  private _notifier: Notifier | null;
  private _feature: EStructuralFeature | null;
  private _featureID: number;

  constructor(options?: {
    unique?: boolean;
    notifier?: Notifier | null;
    feature?: EStructuralFeature | null;
    featureID?: number;
  }) {
    super();
    this._unique = options?.unique ?? false;
    this._notifier = options?.notifier ?? null;
    this._feature = options?.feature ?? null;
    this._featureID = options?.featureID ?? -1;
    Object.setPrototypeOf(this, EListImpl.prototype);
  }

  get notifier(): Notifier | null { return this._notifier; }
  set notifier(n: Notifier | null) { this._notifier = n; }
  get feature(): EStructuralFeature | null { return this._feature; }
  set feature(f: EStructuralFeature | null) { this._feature = f; }
  get featureID(): number { return this._featureID; }
  set featureID(id: number) { this._featureID = id; }

  // --- EList interface ---
  get(index: number): T { return this[index]; }
  size(): number { return this.length; }
  isEmpty(): boolean { return this.length === 0; }
  contains(e: T): boolean { return this.includes(e); }
  containsAll(collection: T[]): boolean { return collection.every(item => this.includes(item)); }
  toArray(): T[] { return [...this]; }
  basicAdd(e: T): void { this.push(e); }

  // --- Add ---
  add(e: T): boolean;
  add(index: number, e: T): void;
  add(indexOrE: number | T, maybeE?: T): boolean | void {
    if (typeof indexOrE === 'number') {
      const e = maybeE!;
      if (this._unique && this.includes(e)) return;
      this.splice(indexOrE, 0, e);
      this._fireNotification(ADD, null, e, indexOrE);
      return;
    }
    if (this._unique && this.includes(indexOrE)) return false;
    this.push(indexOrE);
    this._fireNotification(ADD, null, indexOrE, this.length - 1);
    return true;
  }

  addAll(collection: T[]): boolean;
  addAll(index: number, collection: T[]): boolean;
  addAll(indexOrCol: number | T[], maybeCol?: T[]): boolean {
    if (typeof indexOrCol === 'number') {
      const col = maybeCol!;
      for (const e of col) this.add(indexOrCol++, e);
      return col.length > 0;
    }
    let changed = false;
    for (const e of indexOrCol) { if (this.add(e)) changed = true; }
    return changed;
  }

  // --- AddUnique ---
  // Overloaded: addUnique(e) | addUnique(index, e) — uses 'as any' for overload
  addUnique(e: T): void;
  addUnique(index: number, e: T): void;
  addUnique(eOrIndex: T | number, maybeE?: T): void {
    const e = maybeE !== undefined ? maybeE : eOrIndex as T;
    const index = maybeE !== undefined ? (eOrIndex as number) : undefined;
    if ((this as T[]).includes(e)) throw new DuplicateException(`Element already exists`);
    if (index !== undefined) { this.splice(index, 0, e); this._fireNotification(ADD, null, e, index); }
    else { this.push(e); this._fireNotification(ADD, null, e, this.length - 1); }
  }
  // Overloaded: addAllUnique(collection) | addAllUnique(index, collection)
  addAllUnique(collection: T[]): boolean;
  addAllUnique(index: number, collection: T[]): boolean;
  addAllUnique(indexOrCol: number | T[], maybeCol?: T[]): boolean {
    const col = maybeCol !== undefined ? maybeCol : indexOrCol as T[];
    let startIndex = maybeCol !== undefined ? (indexOrCol as number) : undefined;
    let changed = false;
    for (const e of col) {
      if (startIndex !== undefined) {
        (this as any).addUnique(startIndex, e);
        startIndex++;
      } else {
        (this as any).addUnique(e);
      }
      changed = true;
    }
    return changed;
  }

  // --- Move ---
  move(newIndex: number, e: T): void;
  move(oldIndex: number, newIndex: number): T;
  move(a: number, b: number | T): T | void {
    if (typeof b === 'number') {
      if (a === b) return this[a];
      const element = this[a];
      this.splice(a, 1);
      this.splice(b, 0, element);
      this._fireNotification(MOVE, element, element, b);
      return element;
    }
    const oldIndex = this.indexOf(b);
    if (oldIndex === -1) return;
    this.splice(oldIndex, 1);
    const adjusted = (a as number) > oldIndex ? (a as number) - 1 : a as number;
    this.splice(adjusted, 0, b);
    this._fireNotification(MOVE, null, b, adjusted);
  }

  // --- Remove ---
  remove(index: number): T;
  remove(e: T): boolean;
  remove(indexOrE: number | T): T | boolean {
    if (typeof indexOrE === 'number') {
      const removed = this.splice(indexOrE, 1)[0];
      if (removed !== undefined) this._fireNotification(REMOVE, removed, null, indexOrE);
      return removed;
    }
    const index = this.indexOf(indexOrE);
    if (index === -1) return false;
    this.splice(index, 1);
    this._fireNotification(REMOVE, indexOrE, null, index);
    return true;
  }

  removeAll(collection: T[]): boolean {
    let changed = false;
    for (const item of collection) { if (this.remove(item)) changed = true; }
    return changed;
  }

  retainAll(collection: T[]): boolean {
    const toRemove = this.filter(item => !collection.includes(item));
    for (const item of toRemove) this.remove(item);
    return toRemove.length > 0;
  }

  clear(): void {
    if (this.length === 0) return;
    const oldData = [...this];
    this.length = 0;
    this._fireNotification(REMOVE_MANY, oldData, null, -1);
  }

  // --- Set ---
  set(index: number, e: T): T {
    const oldValue = this[index];
    if (this._unique && this.includes(e) && this.indexOf(e) !== index) {
      throw new DuplicateException(`Element already exists in unique list`);
    }
    this[index] = e;
    this._fireNotification(SET, oldValue, e, index);
    return oldValue;
  }

  // --- Iterator ---
  [Symbol.iterator](): IterableIterator<T> {
    return Array.prototype[Symbol.iterator].bind(this)();
  }

  // --- Private helpers ---
  private _fireNotification(eventType: number, oldValue: any, newValue: any, position: number): void {
    if (!this._notifier || !this._notifier.eDeliver()) return;
    const notification = new NotificationImpl(
      eventType,
      this._notifier as any,
      this._featureID,
      oldValue,
      newValue,
      position
    );
    this._notifier.eNotify(notification);
  }

  /** Copia elementos de un array sin notificaciones */
  _initFrom(source: T[]): void {
    this.length = 0;
    for (const item of source) {
      this.push(item);
    }
  }
}
