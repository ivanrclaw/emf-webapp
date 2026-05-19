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

// ── Type Kind Discriminator ─────────────────────────────────────────

export type OCLTypeKind =
  | 'primitive'
  | 'collection'
  | 'tuple'
  | 'class'
  | 'enum'
  | 'void'
  | 'invalid'
  | 'any';

// ── Primitive Type Names ────────────────────────────────────────────

export type PrimitiveTypeName =
  | 'Boolean'
  | 'Integer'
  | 'Real'
  | 'UnlimitedNatural'
  | 'String';

// ── Collection Kind ─────────────────────────────────────────────────

export type CollectionKind =
  | 'Collection'
  | 'Set'
  | 'Bag'
  | 'Sequence'
  | 'OrderedSet';

// ── Type Definitions ────────────────────────────────────────────────

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

// ── Union Type ──────────────────────────────────────────────────────

export type OCLType =
  | PrimitiveType
  | CollectionType
  | TupleType
  | ClassType
  | EnumType
  | VoidType
  | InvalidType
  | AnyType;

// ── Factory Helpers ─────────────────────────────────────────────────

export const OCL = {
  // Primitives
  Boolean: { kind: 'primitive', name: 'Boolean' } as PrimitiveType,
  Integer: { kind: 'primitive', name: 'Integer' } as PrimitiveType,
  Real: { kind: 'primitive', name: 'Real' } as PrimitiveType,
  UnlimitedNatural: { kind: 'primitive', name: 'UnlimitedNatural' } as PrimitiveType,
  String: { kind: 'primitive', name: 'String' } as PrimitiveType,

  // Special
  Void: { kind: 'void' } as VoidType,
  Invalid: { kind: 'invalid' } as InvalidType,
  Any: { kind: 'any' } as AnyType,

  // Collection constructors
  SetOf(elementType: OCLType): CollectionType {
    return { kind: 'collection', collectionKind: 'Set', elementType };
  },
  BagOf(elementType: OCLType): CollectionType {
    return { kind: 'collection', collectionKind: 'Bag', elementType };
  },
  SequenceOf(elementType: OCLType): CollectionType {
    return { kind: 'collection', collectionKind: 'Sequence', elementType };
  },
  OrderedSetOf(elementType: OCLType): CollectionType {
    return { kind: 'collection', collectionKind: 'OrderedSet', elementType };
  },
  CollectionOf(elementType: OCLType): CollectionType {
    return { kind: 'collection', collectionKind: 'Collection', elementType };
  },

  // Tuple constructor
  Tuple(parts: TuplePart[]): TupleType {
    return { kind: 'tuple', parts };
  },

  // Class constructor
  Class(name: string, supertypes?: string[]): ClassType {
    return { kind: 'class', name, supertypes };
  },

  // Enum constructor
  Enum(name: string, literals: string[]): EnumType {
    return { kind: 'enum', name, literals };
  },
} as const;

// ── Type Display ────────────────────────────────────────────────────

export function typeToString(type: OCLType): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;
    case 'collection':
      return `${type.collectionKind}(${typeToString(type.elementType)})`;
    case 'tuple': {
      const parts = type.parts.map((p) => `${p.name}: ${typeToString(p.type)}`);
      return `Tuple(${parts.join(', ')})`;
    }
    case 'class':
      return type.name;
    case 'enum':
      return type.name;
    case 'void':
      return 'OclVoid';
    case 'invalid':
      return 'OclInvalid';
    case 'any':
      return 'OclAny';
  }
}

// ── Type Equality ───────────────────────────────────────────────────

export function typesEqual(a: OCLType, b: OCLType): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'primitive':
      return a.name === (b as PrimitiveType).name;
    case 'collection': {
      const bc = b as CollectionType;
      return a.collectionKind === bc.collectionKind && typesEqual(a.elementType, bc.elementType);
    }
    case 'tuple': {
      const bt = b as TupleType;
      if (a.parts.length !== bt.parts.length) return false;
      return a.parts.every((ap, i) =>
        ap.name === bt.parts[i].name && typesEqual(ap.type, bt.parts[i].type),
      );
    }
    case 'class':
      return a.name === (b as ClassType).name;
    case 'enum':
      return a.name === (b as EnumType).name;
    case 'void':
    case 'invalid':
    case 'any':
      return true;
  }
}
