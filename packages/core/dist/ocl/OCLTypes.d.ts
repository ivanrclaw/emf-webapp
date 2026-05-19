/**
 * OCLTypes — Definiciones del sistema de tipos OCL 2.4
 *
 * Jerarquía completa:
 *   OclAny (top)
 *   ├── Boolean, String, Real → Integer → UnlimitedNatural
 *   ├── User classes (EClass), Enumerations
 *   ├── OclVoid (null), OclInvalid (error)
 *   └── Collection(T) → Set, Bag, Sequence, OrderedSet
 *   Tuple(part1:T1, part2:T2, ...)
 */
export type OCLTypeKind = 'primitive' | 'collection' | 'tuple' | 'class' | 'enum' | 'void' | 'invalid' | 'any';
export type PrimitiveTypeName = 'Boolean' | 'Integer' | 'Real' | 'UnlimitedNatural' | 'String';
export type CollectionKind = 'Collection' | 'Set' | 'Bag' | 'Sequence' | 'OrderedSet';
export interface PrimitiveType {
    kind: 'primitive';
    name: PrimitiveTypeName;
}
export interface CollectionType {
    kind: 'collection';
    collectionKind: CollectionKind;
    elementType: OCLType;
}
export interface TupleType {
    kind: 'tuple';
    parts: TuplePart[];
}
export interface TuplePart {
    name: string;
    type: OCLType;
}
export interface ClassType {
    kind: 'class';
    name: string;
    /** Superclass names for inheritance resolution */
    supertypes?: string[];
}
export interface EnumType {
    kind: 'enum';
    name: string;
    literals: string[];
}
export interface VoidType {
    kind: 'void';
}
export interface InvalidType {
    kind: 'invalid';
}
export interface AnyType {
    kind: 'any';
}
export type OCLType = PrimitiveType | CollectionType | TupleType | ClassType | EnumType | VoidType | InvalidType | AnyType;
export declare const OCL: {
    readonly Boolean: PrimitiveType;
    readonly Integer: PrimitiveType;
    readonly Real: PrimitiveType;
    readonly UnlimitedNatural: PrimitiveType;
    readonly String: PrimitiveType;
    readonly Void: VoidType;
    readonly Invalid: InvalidType;
    readonly Any: AnyType;
    readonly SetOf: (elementType: OCLType) => CollectionType;
    readonly BagOf: (elementType: OCLType) => CollectionType;
    readonly SequenceOf: (elementType: OCLType) => CollectionType;
    readonly OrderedSetOf: (elementType: OCLType) => CollectionType;
    readonly CollectionOf: (elementType: OCLType) => CollectionType;
    readonly Tuple: (parts: TuplePart[]) => TupleType;
    readonly Class: (name: string, supertypes?: string[]) => ClassType;
    readonly Enum: (name: string, literals: string[]) => EnumType;
};
export declare function typeToString(type: OCLType): string;
export declare function typesEqual(a: OCLType, b: OCLType): boolean;
//# sourceMappingURL=OCLTypes.d.ts.map