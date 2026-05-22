/**
 * OCLStandardLibrary — Catálogo completo de operaciones OCL 2.4
 *
 * Define las firmas de TODAS las operaciones disponibles para cada tipo.
 * Usado por el type inference engine y el autocompletado.
 */
import { OCL, } from './OCLTypes.js';
// ── Resolved return type helper ─────────────────────────────────────
/**
 * Resolve a return type placeholder given the context.
 * 'self' → the type of the receiver
 * 'elementType' → the element type of a collection
 * 'boolean' → Boolean
 */
export function resolveReturnType(returnType, selfType) {
    if (returnType === 'self')
        return selfType;
    if (returnType === 'boolean')
        return OCL.Boolean;
    if (returnType === 'elementType') {
        if (selfType.kind === 'collection')
            return selfType.elementType;
        return OCL.Any;
    }
    return returnType;
}
// ── OclAny Operations ───────────────────────────────────────────────
export const OclAnyOperations = [
    { name: '=', params: [{ name: 'object2', type: OCL.Any }], returnType: OCL.Boolean, description: 'Equality' },
    { name: '<>', params: [{ name: 'object2', type: OCL.Any }], returnType: OCL.Boolean, description: 'Inequality' },
    { name: 'oclIsTypeOf', params: [{ name: 'type', type: OCL.Any }], returnType: OCL.Boolean, description: 'True if self is exactly of the given type' },
    { name: 'oclIsKindOf', params: [{ name: 'type', type: OCL.Any }], returnType: OCL.Boolean, description: 'True if self is of the given type or a subtype' },
    { name: 'oclAsType', params: [{ name: 'type', type: OCL.Any }], returnType: 'self', description: 'Cast to the given type' },
    { name: 'oclIsUndefined', params: [], returnType: OCL.Boolean, description: 'True if self is null' },
    { name: 'oclIsInvalid', params: [], returnType: OCL.Boolean, description: 'True if self is invalid' },
    { name: 'oclAsSet', params: [], returnType: OCL.SetOf(OCL.Any), description: 'Wraps self in a singleton Set' },
    { name: 'oclContainer', params: [], returnType: OCL.Any, description: 'Returns the containing object (parent in containment hierarchy)' },
    { name: 'oclContents', params: [], returnType: OCL.SetOf(OCL.Any), description: 'Returns the direct contents (children in containment hierarchy)' },
    { name: 'oclType', params: [], returnType: OCL.Any, description: 'Returns the type of self' },
    { name: 'toString', params: [], returnType: OCL.String, description: 'String representation' },
];
// ── Boolean Operations ──────────────────────────────────────────────
export const BooleanOperations = [
    { name: 'and', params: [{ name: 'b', type: OCL.Boolean }], returnType: OCL.Boolean, description: 'Logical AND (3-valued)' },
    { name: 'or', params: [{ name: 'b', type: OCL.Boolean }], returnType: OCL.Boolean, description: 'Logical OR (3-valued)' },
    { name: 'xor', params: [{ name: 'b', type: OCL.Boolean }], returnType: OCL.Boolean, description: 'Logical XOR' },
    { name: 'not', params: [], returnType: OCL.Boolean, description: 'Logical NOT' },
    { name: 'implies', params: [{ name: 'b', type: OCL.Boolean }], returnType: OCL.Boolean, description: 'Logical implication (3-valued)' },
    { name: 'toString', params: [], returnType: OCL.String, description: 'String representation' },
];
// ── Integer Operations ──────────────────────────────────────────────
export const IntegerOperations = [
    { name: '+', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Integer, description: 'Addition' },
    { name: '-', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Integer, description: 'Subtraction' },
    { name: '*', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Integer, description: 'Multiplication' },
    { name: '/', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Real, description: 'Division (returns Real)' },
    { name: 'div', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Integer, description: 'Integer division' },
    { name: 'mod', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Integer, description: 'Modulo' },
    { name: 'abs', params: [], returnType: OCL.Integer, description: 'Absolute value' },
    { name: 'max', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Integer, description: 'Maximum of self and i' },
    { name: 'min', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Integer, description: 'Minimum of self and i' },
    { name: '<', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Boolean, description: 'Less than' },
    { name: '<=', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Boolean, description: 'Less than or equal' },
    { name: '>', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Boolean, description: 'Greater than' },
    { name: '>=', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.Boolean, description: 'Greater than or equal' },
    { name: 'toString', params: [], returnType: OCL.String, description: 'String representation' },
    { name: 'toUnlimitedNatural', params: [], returnType: OCL.UnlimitedNatural, description: 'Convert to UnlimitedNatural' },
];
// ── Real Operations ─────────────────────────────────────────────────
export const RealOperations = [
    { name: '+', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Real, description: 'Addition' },
    { name: '-', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Real, description: 'Subtraction' },
    { name: '*', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Real, description: 'Multiplication' },
    { name: '/', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Real, description: 'Division' },
    { name: 'abs', params: [], returnType: OCL.Real, description: 'Absolute value' },
    { name: 'floor', params: [], returnType: OCL.Integer, description: 'Floor (round down)' },
    { name: 'round', params: [], returnType: OCL.Integer, description: 'Round to nearest integer' },
    { name: 'max', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Real, description: 'Maximum of self and r' },
    { name: 'min', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Real, description: 'Minimum of self and r' },
    { name: '<', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Boolean, description: 'Less than' },
    { name: '<=', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Boolean, description: 'Less than or equal' },
    { name: '>', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Boolean, description: 'Greater than' },
    { name: '>=', params: [{ name: 'r', type: OCL.Real }], returnType: OCL.Boolean, description: 'Greater than or equal' },
    { name: 'toString', params: [], returnType: OCL.String, description: 'String representation' },
];
// ── String Operations ───────────────────────────────────────────────
export const StringOperations = [
    // Query
    { name: 'size', params: [], returnType: OCL.Integer, description: 'Number of characters' },
    { name: 'at', params: [{ name: 'i', type: OCL.Integer }], returnType: OCL.String, description: 'Character at position i (1-based)' },
    { name: 'characters', params: [], returnType: OCL.SequenceOf(OCL.String), description: 'Sequence of individual characters' },
    { name: 'indexOf', params: [{ name: 's', type: OCL.String }], returnType: OCL.Integer, description: 'Index of first occurrence (1-based, 0 if not found)' },
    { name: 'lastIndexOf', params: [{ name: 's', type: OCL.String }], returnType: OCL.Integer, description: 'Index of last occurrence (1-based, 0 if not found)' },
    { name: 'substring', params: [{ name: 'lower', type: OCL.Integer }, { name: 'upper', type: OCL.Integer }], returnType: OCL.String, description: 'Substring from lower to upper (1-based, inclusive)' },
    // Testing
    { name: 'startsWith', params: [{ name: 's', type: OCL.String }], returnType: OCL.Boolean, description: 'True if self starts with s' },
    { name: 'endsWith', params: [{ name: 's', type: OCL.String }], returnType: OCL.Boolean, description: 'True if self ends with s' },
    { name: 'equalsIgnoreCase', params: [{ name: 's', type: OCL.String }], returnType: OCL.Boolean, description: 'Case-insensitive equality' },
    { name: 'matches', params: [{ name: 'regex', type: OCL.String }], returnType: OCL.Boolean, description: 'True if self matches the regex' },
    // Manipulation
    { name: 'concat', params: [{ name: 's', type: OCL.String }], returnType: OCL.String, description: 'Concatenation' },
    { name: '+', params: [{ name: 's', type: OCL.String }], returnType: OCL.String, description: 'Concatenation (operator)' },
    { name: 'toUpperCase', params: [], returnType: OCL.String, description: 'Convert to upper case' },
    { name: 'toLowerCase', params: [], returnType: OCL.String, description: 'Convert to lower case' },
    { name: 'toUpper', params: [], returnType: OCL.String, description: 'Convert to upper case', deprecated: 'Use toUpperCase()' },
    { name: 'toLower', params: [], returnType: OCL.String, description: 'Convert to lower case', deprecated: 'Use toLowerCase()' },
    { name: 'trim', params: [], returnType: OCL.String, description: 'Remove leading/trailing whitespace' },
    { name: 'replaceAll', params: [{ name: 'regex', type: OCL.String }, { name: 'replacement', type: OCL.String }], returnType: OCL.String, description: 'Replace all regex matches' },
    { name: 'replaceFirst', params: [{ name: 'regex', type: OCL.String }, { name: 'replacement', type: OCL.String }], returnType: OCL.String, description: 'Replace first regex match' },
    { name: 'substituteAll', params: [{ name: 'old', type: OCL.String }, { name: 'new_', type: OCL.String }], returnType: OCL.String, description: 'Replace all literal occurrences' },
    { name: 'substituteFirst', params: [{ name: 'old', type: OCL.String }, { name: 'new_', type: OCL.String }], returnType: OCL.String, description: 'Replace first literal occurrence' },
    // Tokenization
    { name: 'tokenize', params: [], returnType: OCL.SequenceOf(OCL.String), description: 'Split by whitespace' },
    // Conversion
    { name: 'toInteger', params: [], returnType: OCL.Integer, description: 'Parse as Integer' },
    { name: 'toReal', params: [], returnType: OCL.Real, description: 'Parse as Real' },
    { name: 'toBoolean', params: [], returnType: OCL.Boolean, description: 'Parse as Boolean' },
    { name: 'toString', params: [], returnType: OCL.String, description: 'Returns self' },
    // Comparison
    { name: '<', params: [{ name: 's', type: OCL.String }], returnType: OCL.Boolean, description: 'Lexicographic less than' },
    { name: '<=', params: [{ name: 's', type: OCL.String }], returnType: OCL.Boolean, description: 'Lexicographic less than or equal' },
    { name: '>', params: [{ name: 's', type: OCL.String }], returnType: OCL.Boolean, description: 'Lexicographic greater than' },
    { name: '>=', params: [{ name: 's', type: OCL.String }], returnType: OCL.Boolean, description: 'Lexicographic greater than or equal' },
];
// ── Collection(T) Operations ────────────────────────────────────────
export const CollectionOperations = [
    // Membership & Counting
    { name: 'size', params: [], returnType: OCL.Integer, description: 'Number of elements' },
    { name: 'isEmpty', params: [], returnType: OCL.Boolean, description: 'True if collection has no elements' },
    { name: 'notEmpty', params: [], returnType: OCL.Boolean, description: 'True if collection has at least one element' },
    { name: 'includes', params: [{ name: 'object', type: OCL.Any }], returnType: OCL.Boolean, description: 'True if object is in the collection' },
    { name: 'excludes', params: [{ name: 'object', type: OCL.Any }], returnType: OCL.Boolean, description: 'True if object is NOT in the collection' },
    { name: 'includesAll', params: [{ name: 'c2', type: OCL.CollectionOf(OCL.Any) }], returnType: OCL.Boolean, description: 'True if all elements of c2 are in self' },
    { name: 'excludesAll', params: [{ name: 'c2', type: OCL.CollectionOf(OCL.Any) }], returnType: OCL.Boolean, description: 'True if no element of c2 is in self' },
    { name: 'count', params: [{ name: 'object', type: OCL.Any }], returnType: OCL.Integer, description: 'Number of occurrences of object' },
    // Adding & Removing
    { name: 'including', params: [{ name: 'object', type: OCL.Any }], returnType: 'self', description: 'Collection with object added' },
    { name: 'includingAll', params: [{ name: 'objects', type: OCL.CollectionOf(OCL.Any) }], returnType: 'self', description: 'Collection with all objects added' },
    { name: 'excluding', params: [{ name: 'object', type: OCL.Any }], returnType: 'self', description: 'Collection with object removed' },
    { name: 'excludingAll', params: [{ name: 'objects', type: OCL.CollectionOf(OCL.Any) }], returnType: 'self', description: 'Collection with all objects removed' },
    // Set operations
    { name: 'union', params: [{ name: 'c', type: OCL.CollectionOf(OCL.Any) }], returnType: 'self', description: 'Union of two collections' },
    { name: 'intersection', params: [{ name: 'c', type: OCL.CollectionOf(OCL.Any) }], returnType: 'self', description: 'Intersection of two collections' },
    // Conversion
    { name: 'asSet', params: [], returnType: OCL.SetOf(OCL.Any), description: 'Convert to Set (removes duplicates)' },
    { name: 'asBag', params: [], returnType: OCL.BagOf(OCL.Any), description: 'Convert to Bag' },
    { name: 'asSequence', params: [], returnType: OCL.SequenceOf(OCL.Any), description: 'Convert to Sequence' },
    { name: 'asOrderedSet', params: [], returnType: OCL.OrderedSetOf(OCL.Any), description: 'Convert to OrderedSet' },
    // Aggregation
    { name: 'sum', params: [], returnType: 'elementType', description: 'Sum of numeric elements' },
    { name: 'min', params: [], returnType: 'elementType', description: 'Minimum element' },
    { name: 'max', params: [], returnType: 'elementType', description: 'Maximum element' },
    // Flattening & Filtering
    { name: 'flatten', params: [], returnType: 'self', description: 'Flatten nested collections' },
    { name: 'selectByKind', params: [{ name: 'type', type: OCL.Any }], returnType: 'self', description: 'Elements that are of the given type or subtype' },
    { name: 'selectByType', params: [{ name: 'type', type: OCL.Any }], returnType: 'self', description: 'Elements that are exactly of the given type' },
    // Product
    { name: 'product', params: [{ name: 'c2', type: OCL.CollectionOf(OCL.Any) }], returnType: OCL.SetOf(OCL.Any), description: 'Cartesian product → Set(Tuple(first:T, second:T2))' },
];
// ── Collection Iterator Operations ──────────────────────────────────
export const CollectionIteratorOperations = [
    { name: 'forAll', params: [{ name: 'body', type: OCL.Boolean }], returnType: OCL.Boolean, description: 'True if body is true for all elements', isIterator: true },
    { name: 'exists', params: [{ name: 'body', type: OCL.Boolean }], returnType: OCL.Boolean, description: 'True if body is true for at least one element', isIterator: true },
    { name: 'one', params: [{ name: 'body', type: OCL.Boolean }], returnType: OCL.Boolean, description: 'True if body is true for exactly one element', isIterator: true },
    { name: 'isUnique', params: [{ name: 'body', type: OCL.Any }], returnType: OCL.Boolean, description: 'True if body evaluates to a unique value for each element', isIterator: true },
    { name: 'any', params: [{ name: 'body', type: OCL.Boolean }], returnType: 'elementType', description: 'Any element satisfying body', isIterator: true },
    { name: 'select', params: [{ name: 'body', type: OCL.Boolean }], returnType: 'self', description: 'Elements for which body is true', isIterator: true },
    { name: 'reject', params: [{ name: 'body', type: OCL.Boolean }], returnType: 'self', description: 'Elements for which body is false', isIterator: true },
    { name: 'collect', params: [{ name: 'body', type: OCL.Any }], returnType: OCL.BagOf(OCL.Any), description: 'Apply body to each element (flattens)', isIterator: true },
    { name: 'collectNested', params: [{ name: 'body', type: OCL.Any }], returnType: OCL.BagOf(OCL.Any), description: 'Apply body to each element (no flattening)', isIterator: true },
    { name: 'closure', params: [{ name: 'body', type: OCL.Any }], returnType: OCL.SetOf(OCL.Any), description: 'Transitive closure', isIterator: true },
    { name: 'sortedBy', params: [{ name: 'body', type: OCL.Any }], returnType: OCL.SequenceOf(OCL.Any), description: 'Elements sorted by body expression', isIterator: true },
    { name: 'iterate', params: [{ name: 'body', type: OCL.Any }], returnType: OCL.Any, description: 'General accumulator iteration', isIterator: true },
];
// ── OrderedSet/Sequence-specific Operations ─────────────────────────
export const OrderedCollectionOperations = [
    { name: 'first', params: [], returnType: 'elementType', description: 'First element' },
    { name: 'last', params: [], returnType: 'elementType', description: 'Last element' },
    { name: 'at', params: [{ name: 'index', type: OCL.Integer }], returnType: 'elementType', description: 'Element at position (1-based)' },
    { name: 'indexOf', params: [{ name: 'obj', type: OCL.Any }], returnType: OCL.Integer, description: 'Index of first occurrence (1-based)' },
    { name: 'append', params: [{ name: 'object', type: OCL.Any }], returnType: 'self', description: 'Add element at end' },
    { name: 'prepend', params: [{ name: 'object', type: OCL.Any }], returnType: 'self', description: 'Add element at beginning' },
    { name: 'appendAll', params: [{ name: 'objects', type: OCL.CollectionOf(OCL.Any) }], returnType: 'self', description: 'Add all elements at end' },
    { name: 'prependAll', params: [{ name: 'objects', type: OCL.CollectionOf(OCL.Any) }], returnType: 'self', description: 'Add all elements at beginning' },
    { name: 'insertAt', params: [{ name: 'index', type: OCL.Integer }, { name: 'object', type: OCL.Any }], returnType: 'self', description: 'Insert element at position' },
    { name: 'reverse', params: [], returnType: 'self', description: 'Reverse order' },
];
// ── Sequence-specific Operations ────────────────────────────────────
export const SequenceOperations = [
    { name: 'subSequence', params: [{ name: 'lower', type: OCL.Integer }, { name: 'upper', type: OCL.Integer }], returnType: 'self', description: 'Sub-sequence from lower to upper (1-based, inclusive)' },
];
// ── OrderedSet-specific Operations ──────────────────────────────────
export const OrderedSetOperations = [
    { name: 'subOrderedSet', params: [{ name: 'lower', type: OCL.Integer }, { name: 'upper', type: OCL.Integer }], returnType: 'self', description: 'Sub-ordered-set from lower to upper (1-based, inclusive)' },
];
// ── Set-specific Operations ─────────────────────────────────────────
export const SetOperations = [
    { name: '-', params: [{ name: 's', type: OCL.SetOf(OCL.Any) }], returnType: 'self', description: 'Set difference' },
    { name: 'symmetricDifference', params: [{ name: 's', type: OCL.SetOf(OCL.Any) }], returnType: 'self', description: 'Elements in exactly one of the two sets' },
];
// ── Lookup: get operations for a given type ─────────────────────────
/**
 * Returns all operations available on a given OCL type.
 * Includes inherited operations (e.g., OclAny ops on all types).
 */
export function getOperationsForType(type) {
    const ops = [...OclAnyOperations];
    switch (type.kind) {
        case 'primitive':
            ops.push(...getOperationsForPrimitive(type.name));
            break;
        case 'collection':
            ops.push(...CollectionOperations);
            ops.push(...CollectionIteratorOperations);
            if (isOrderedCollection(type.collectionKind)) {
                ops.push(...OrderedCollectionOperations);
            }
            if (type.collectionKind === 'Sequence') {
                ops.push(...SequenceOperations);
            }
            if (type.collectionKind === 'OrderedSet') {
                ops.push(...OrderedSetOperations);
            }
            if (type.collectionKind === 'Set' || type.collectionKind === 'OrderedSet') {
                ops.push(...SetOperations);
            }
            break;
        case 'class':
        case 'enum':
        case 'tuple':
            // Only OclAny operations (already added)
            break;
        case 'any':
        case 'void':
        case 'invalid':
            break;
    }
    return ops;
}
function getOperationsForPrimitive(name) {
    switch (name) {
        case 'Boolean':
            return BooleanOperations;
        case 'Integer':
        case 'UnlimitedNatural':
            return IntegerOperations;
        case 'Real':
            return RealOperations;
        case 'String':
            return StringOperations;
    }
}
function isOrderedCollection(kind) {
    return kind === 'Sequence' || kind === 'OrderedSet';
}
//# sourceMappingURL=OCLStandardLibrary.js.map