/**
 * OCLConformance — Reglas de conformidad de tipos OCL 2.4
 *
 * Implementa las reglas del estándar OMG:
 * 1. Reflexiva: T conforms to T
 * 2. Integer conforms to Real
 * 3. UnlimitedNatural conforms to Integer
 * 4. OclVoid conforms to all (except OclInvalid)
 * 5. OclInvalid conforms to all (including OclVoid)
 * 6. All user classes conform to OclAny
 * 7. Covariance: Set(T2) conforms to Set(T1) if T2 conforms to T1
 * 8. Tuple conformance: same part names, conforming types
 * 9. Transitivity
 */
import { typesEqual, } from './OCLTypes.js';
/**
 * Check if typeA conforms to typeB (i.e., typeA is assignable to typeB).
 *
 * "A conforms to B" means: wherever B is expected, A can be used.
 */
export function conformsTo(typeA, typeB, hierarchy) {
    // Rule 1: Reflexive — every type conforms to itself
    if (typesEqual(typeA, typeB))
        return true;
    // Rule: Everything conforms to OclAny
    if (typeB.kind === 'any')
        return true;
    // Rule 5: OclInvalid conforms to ALL types
    if (typeA.kind === 'invalid')
        return true;
    // Rule 4: OclVoid conforms to all types EXCEPT OclInvalid
    if (typeA.kind === 'void') {
        return typeB.kind !== 'invalid';
    }
    // Primitive conformance
    if (typeA.kind === 'primitive' && typeB.kind === 'primitive') {
        return primitivConformsTo(typeA.name, typeB.name);
    }
    // Rule 7: Collection covariance
    if (typeA.kind === 'collection' && typeB.kind === 'collection') {
        return collectionConformsTo(typeA, typeB, hierarchy);
    }
    // Rule 8: Tuple conformance
    if (typeA.kind === 'tuple' && typeB.kind === 'tuple') {
        return tupleConformsTo(typeA, typeB, hierarchy);
    }
    // Class conformance (inheritance)
    if (typeA.kind === 'class' && typeB.kind === 'class') {
        return classConformsTo(typeA, typeB, hierarchy);
    }
    // Class conforms to OclAny (already handled above via typeB.kind === 'any')
    // Enum conforms to OclAny (already handled above)
    return false;
}
// ── Primitive Conformance ───────────────────────────────────────────
function primitivConformsTo(a, b) {
    if (a === b)
        return true;
    // UnlimitedNatural → Integer → Real
    if (a === 'UnlimitedNatural' && (b === 'Integer' || b === 'Real'))
        return true;
    if (a === 'Integer' && b === 'Real')
        return true;
    return false;
}
// ── Collection Conformance ──────────────────────────────────────────
function collectionConformsTo(a, b, hierarchy) {
    // Same collection kind + covariant element type
    if (a.collectionKind === b.collectionKind) {
        return conformsTo(a.elementType, b.elementType, hierarchy);
    }
    // Subtype relationships between collection kinds:
    // Set conforms to Collection
    // Bag conforms to Collection
    // Sequence conforms to Collection
    // OrderedSet conforms to Collection
    // OrderedSet conforms to Set (unique)
    // Sequence does NOT conform to Bag (different semantics in OCL 2.4)
    if (b.collectionKind === 'Collection') {
        return conformsTo(a.elementType, b.elementType, hierarchy);
    }
    // OrderedSet conforms to Set (both are unique collections)
    if (a.collectionKind === 'OrderedSet' && b.collectionKind === 'Set') {
        return conformsTo(a.elementType, b.elementType, hierarchy);
    }
    return false;
}
// ── Tuple Conformance ───────────────────────────────────────────────
function tupleConformsTo(a, b, hierarchy) {
    // Must have same number of parts
    if (a.parts.length !== b.parts.length)
        return false;
    // Each part in B must have a matching part in A with conforming type
    for (const bPart of b.parts) {
        const aPart = a.parts.find((p) => p.name === bPart.name);
        if (!aPart)
            return false;
        if (!conformsTo(aPart.type, bPart.type, hierarchy))
            return false;
    }
    return true;
}
// ── Class Conformance (Inheritance) ─────────────────────────────────
function classConformsTo(a, b, hierarchy) {
    if (a.name === b.name)
        return true;
    if (!hierarchy) {
        // Without hierarchy info, check inline supertypes
        return a.supertypes?.includes(b.name) ?? false;
    }
    // BFS through the hierarchy
    const visited = new Set();
    const queue = [a.name];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === b.name)
            return true;
        if (visited.has(current))
            continue;
        visited.add(current);
        const supers = hierarchy.get(current);
        if (supers) {
            queue.push(...supers);
        }
    }
    return false;
}
// ── Common Supertype ────────────────────────────────────────────────
/**
 * Find the most specific common supertype of two types.
 * Used for type inference in if-then-else, collection unions, etc.
 */
export function commonSupertype(a, b, hierarchy) {
    // Same type
    if (typesEqual(a, b))
        return a;
    // One conforms to the other
    if (conformsTo(a, b, hierarchy))
        return b;
    if (conformsTo(b, a, hierarchy))
        return a;
    // Both primitives — find common
    if (a.kind === 'primitive' && b.kind === 'primitive') {
        // Integer + Real → Real
        if ((a.name === 'Integer' && b.name === 'Real') ||
            (a.name === 'Real' && b.name === 'Integer')) {
            return { kind: 'primitive', name: 'Real' };
        }
        // UnlimitedNatural + Integer → Integer
        if ((a.name === 'UnlimitedNatural' && b.name === 'Integer') ||
            (a.name === 'Integer' && b.name === 'UnlimitedNatural')) {
            return { kind: 'primitive', name: 'Integer' };
        }
        // UnlimitedNatural + Real → Real
        if ((a.name === 'UnlimitedNatural' && b.name === 'Real') ||
            (a.name === 'Real' && b.name === 'UnlimitedNatural')) {
            return { kind: 'primitive', name: 'Real' };
        }
    }
    // Both collections — common collection kind + common element type
    if (a.kind === 'collection' && b.kind === 'collection') {
        const elemSuper = commonSupertype(a.elementType, b.elementType, hierarchy);
        // If same collection kind, keep it
        if (a.collectionKind === b.collectionKind) {
            return { kind: 'collection', collectionKind: a.collectionKind, elementType: elemSuper };
        }
        // Otherwise fall back to Collection(T)
        return { kind: 'collection', collectionKind: 'Collection', elementType: elemSuper };
    }
    // Fallback: OclAny
    return { kind: 'any' };
}
//# sourceMappingURL=OCLConformance.js.map