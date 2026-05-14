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
    constructor(message) {
        super(message ?? 'Element already exists in unique list');
        this.name = 'DuplicateException';
    }
}
export class EListImpl extends Array {
    _unique;
    _notifier;
    _feature;
    _featureID;
    constructor(options) {
        super();
        this._unique = options?.unique ?? false;
        this._notifier = options?.notifier ?? null;
        this._feature = options?.feature ?? null;
        this._featureID = options?.featureID ?? -1;
        Object.setPrototypeOf(this, EListImpl.prototype);
    }
    get notifier() { return this._notifier; }
    set notifier(n) { this._notifier = n; }
    get feature() { return this._feature; }
    set feature(f) { this._feature = f; }
    get featureID() { return this._featureID; }
    set featureID(id) { this._featureID = id; }
    // --- EList interface ---
    get(index) { return this[index]; }
    size() { return this.length; }
    isEmpty() { return this.length === 0; }
    contains(e) { return this.includes(e); }
    containsAll(collection) { return collection.every(item => this.includes(item)); }
    toArray() { return [...this]; }
    basicAdd(e) { this.push(e); }
    add(indexOrE, maybeE) {
        if (typeof indexOrE === 'number') {
            const e = maybeE;
            if (this._unique && this.includes(e))
                return;
            this.splice(indexOrE, 0, e);
            this._fireNotification(ADD, null, e, indexOrE);
            return;
        }
        if (this._unique && this.includes(indexOrE))
            return false;
        this.push(indexOrE);
        this._fireNotification(ADD, null, indexOrE, this.length - 1);
        return true;
    }
    addAll(indexOrCol, maybeCol) {
        if (typeof indexOrCol === 'number') {
            const col = maybeCol;
            for (const e of col)
                this.add(indexOrCol++, e);
            return col.length > 0;
        }
        let changed = false;
        for (const e of indexOrCol) {
            if (this.add(e))
                changed = true;
        }
        return changed;
    }
    addUnique(eOrIndex, maybeE) {
        const e = maybeE !== undefined ? maybeE : eOrIndex;
        const index = maybeE !== undefined ? eOrIndex : undefined;
        if (this.includes(e))
            throw new DuplicateException(`Element already exists`);
        if (index !== undefined) {
            this.splice(index, 0, e);
            this._fireNotification(ADD, null, e, index);
        }
        else {
            this.push(e);
            this._fireNotification(ADD, null, e, this.length - 1);
        }
    }
    addAllUnique(indexOrCol, maybeCol) {
        const col = maybeCol !== undefined ? maybeCol : indexOrCol;
        let startIndex = maybeCol !== undefined ? indexOrCol : undefined;
        let changed = false;
        for (const e of col) {
            if (startIndex !== undefined) {
                this.addUnique(startIndex, e);
                startIndex++;
            }
            else {
                this.addUnique(e);
            }
            changed = true;
        }
        return changed;
    }
    move(a, b) {
        if (typeof b === 'number') {
            if (a === b)
                return this[a];
            const element = this[a];
            this.splice(a, 1);
            this.splice(b, 0, element);
            this._fireNotification(MOVE, element, element, b);
            return element;
        }
        const oldIndex = this.indexOf(b);
        if (oldIndex === -1)
            return;
        this.splice(oldIndex, 1);
        const adjusted = a > oldIndex ? a - 1 : a;
        this.splice(adjusted, 0, b);
        this._fireNotification(MOVE, null, b, adjusted);
    }
    remove(indexOrE) {
        if (typeof indexOrE === 'number') {
            const removed = this.splice(indexOrE, 1)[0];
            if (removed !== undefined)
                this._fireNotification(REMOVE, removed, null, indexOrE);
            return removed;
        }
        const index = this.indexOf(indexOrE);
        if (index === -1)
            return false;
        this.splice(index, 1);
        this._fireNotification(REMOVE, indexOrE, null, index);
        return true;
    }
    removeAll(collection) {
        let changed = false;
        for (const item of collection) {
            if (this.remove(item))
                changed = true;
        }
        return changed;
    }
    retainAll(collection) {
        const toRemove = this.filter(item => !collection.includes(item));
        for (const item of toRemove)
            this.remove(item);
        return toRemove.length > 0;
    }
    clear() {
        if (this.length === 0)
            return;
        const oldData = [...this];
        this.length = 0;
        this._fireNotification(REMOVE_MANY, oldData, null, -1);
    }
    // --- Set ---
    set(index, e) {
        const oldValue = this[index];
        if (this._unique && this.includes(e) && this.indexOf(e) !== index) {
            throw new DuplicateException(`Element already exists in unique list`);
        }
        this[index] = e;
        this._fireNotification(SET, oldValue, e, index);
        return oldValue;
    }
    // --- Iterator ---
    [Symbol.iterator]() {
        return Array.prototype[Symbol.iterator].bind(this)();
    }
    // --- Private helpers ---
    _fireNotification(eventType, oldValue, newValue, position) {
        if (!this._notifier || !this._notifier.eDeliver())
            return;
        const notification = new NotificationImpl(eventType, this._notifier, this._featureID, oldValue, newValue, position);
        this._notifier.eNotify(notification);
    }
    /** Copia elementos de un array sin notificaciones */
    _initFrom(source) {
        this.length = 0;
        for (const item of source) {
            this.push(item);
        }
    }
}
//# sourceMappingURL=EList.js.map