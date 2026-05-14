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
import type { EList, Notifier, EStructuralFeature } from '../ecore/interfaces.js';
export declare class DuplicateException extends Error {
    constructor(message?: string);
}
export declare class EListImpl<T> extends Array<T> implements EList<T> {
    private _unique;
    private _notifier;
    private _feature;
    private _featureID;
    constructor(options?: {
        unique?: boolean;
        notifier?: Notifier | null;
        feature?: EStructuralFeature | null;
        featureID?: number;
    });
    get notifier(): Notifier | null;
    set notifier(n: Notifier | null);
    get feature(): EStructuralFeature | null;
    set feature(f: EStructuralFeature | null);
    get featureID(): number;
    set featureID(id: number);
    get(index: number): T;
    size(): number;
    isEmpty(): boolean;
    contains(e: T): boolean;
    containsAll(collection: T[]): boolean;
    toArray(): T[];
    basicAdd(e: T): void;
    add(e: T): boolean;
    add(index: number, e: T): void;
    addAll(collection: T[]): boolean;
    addAll(index: number, collection: T[]): boolean;
    addUnique(e: T): void;
    addUnique(index: number, e: T): void;
    addAllUnique(collection: T[]): boolean;
    addAllUnique(index: number, collection: T[]): boolean;
    move(newIndex: number, e: T): void;
    move(oldIndex: number, newIndex: number): T;
    remove(index: number): T;
    remove(e: T): boolean;
    removeAll(collection: T[]): boolean;
    retainAll(collection: T[]): boolean;
    clear(): void;
    set(index: number, e: T): T;
    [Symbol.iterator](): IterableIterator<T>;
    private _fireNotification;
    /** Copia elementos de un array sin notificaciones */
    _initFrom(source: T[]): void;
}
//# sourceMappingURL=EList.d.ts.map