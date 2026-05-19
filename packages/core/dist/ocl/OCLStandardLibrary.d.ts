/**
 * OCLStandardLibrary — Catálogo completo de operaciones OCL 2.4
 *
 * Define las firmas de TODAS las operaciones disponibles para cada tipo.
 * Usado por el type inference engine y el autocompletado.
 */
import { OCLType } from './OCLTypes.js';
export interface OCLOperationSignature {
    name: string;
    params: OCLOperationParam[];
    returnType: OCLType | 'self' | 'elementType' | 'boolean';
    description: string;
    /** Whether this is an iterator (takes a lambda body) */
    isIterator?: boolean;
    /** Whether this operation is deprecated */
    deprecated?: string;
}
export interface OCLOperationParam {
    name: string;
    type: OCLType | 'self' | 'elementType';
    optional?: boolean;
}
/**
 * Resolve a return type placeholder given the context.
 * 'self' → the type of the receiver
 * 'elementType' → the element type of a collection
 * 'boolean' → Boolean
 */
export declare function resolveReturnType(returnType: OCLType | 'self' | 'elementType' | 'boolean', selfType: OCLType): OCLType;
export declare const OclAnyOperations: OCLOperationSignature[];
export declare const BooleanOperations: OCLOperationSignature[];
export declare const IntegerOperations: OCLOperationSignature[];
export declare const RealOperations: OCLOperationSignature[];
export declare const StringOperations: OCLOperationSignature[];
export declare const CollectionOperations: OCLOperationSignature[];
export declare const CollectionIteratorOperations: OCLOperationSignature[];
export declare const OrderedCollectionOperations: OCLOperationSignature[];
export declare const SequenceOperations: OCLOperationSignature[];
export declare const OrderedSetOperations: OCLOperationSignature[];
export declare const SetOperations: OCLOperationSignature[];
/**
 * Returns all operations available on a given OCL type.
 * Includes inherited operations (e.g., OclAny ops on all types).
 */
export declare function getOperationsForType(type: OCLType): OCLOperationSignature[];
//# sourceMappingURL=OCLStandardLibrary.d.ts.map