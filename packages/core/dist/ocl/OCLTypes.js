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
// ── Factory Helpers ─────────────────────────────────────────────────
export const OCL = {
    // Primitives
    Boolean: { kind: 'primitive', name: 'Boolean' },
    Integer: { kind: 'primitive', name: 'Integer' },
    Real: { kind: 'primitive', name: 'Real' },
    UnlimitedNatural: { kind: 'primitive', name: 'UnlimitedNatural' },
    String: { kind: 'primitive', name: 'String' },
    // Special
    Void: { kind: 'void' },
    Invalid: { kind: 'invalid' },
    Any: { kind: 'any' },
    // Collection constructors
    SetOf(elementType) {
        return { kind: 'collection', collectionKind: 'Set', elementType };
    },
    BagOf(elementType) {
        return { kind: 'collection', collectionKind: 'Bag', elementType };
    },
    SequenceOf(elementType) {
        return { kind: 'collection', collectionKind: 'Sequence', elementType };
    },
    OrderedSetOf(elementType) {
        return { kind: 'collection', collectionKind: 'OrderedSet', elementType };
    },
    CollectionOf(elementType) {
        return { kind: 'collection', collectionKind: 'Collection', elementType };
    },
    // Tuple constructor
    Tuple(parts) {
        return { kind: 'tuple', parts };
    },
    // Class constructor
    Class(name, supertypes) {
        return { kind: 'class', name, supertypes };
    },
    // Enum constructor
    Enum(name, literals) {
        return { kind: 'enum', name, literals };
    },
};
// ── Type Display ────────────────────────────────────────────────────
export function typeToString(type) {
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
export function typesEqual(a, b) {
    if (a.kind !== b.kind)
        return false;
    switch (a.kind) {
        case 'primitive':
            return a.name === b.name;
        case 'collection': {
            const bc = b;
            return a.collectionKind === bc.collectionKind && typesEqual(a.elementType, bc.elementType);
        }
        case 'tuple': {
            const bt = b;
            if (a.parts.length !== bt.parts.length)
                return false;
            return a.parts.every((ap, i) => ap.name === bt.parts[i].name && typesEqual(ap.type, bt.parts[i].type));
        }
        case 'class':
            return a.name === b.name;
        case 'enum':
            return a.name === b.name;
        case 'void':
        case 'invalid':
        case 'any':
            return true;
    }
}
//# sourceMappingURL=OCLTypes.js.map