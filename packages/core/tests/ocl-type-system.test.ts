/**
 * Tests — OCL Type System: Types, Conformance, Standard Library
 */
import { describe, it, expect } from 'vitest';
import {
  OCL,
  typesEqual,
  typeToString,
} from '../src/ocl/OCLTypes.js';
import {
  conformsTo,
  commonSupertype,
} from '../src/ocl/OCLConformance.js';
import {
  getOperationsForType,
} from '../src/ocl/OCLStandardLibrary.js';

// ═══════════════════════════════════════════════════════════════════════
// TYPE EQUALITY
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypes — typesEqual', () => {
  it('same primitive types are equal', () => {
    expect(typesEqual(OCL.Integer, OCL.Integer)).toBe(true);
    expect(typesEqual(OCL.String, OCL.String)).toBe(true);
    expect(typesEqual(OCL.Boolean, OCL.Boolean)).toBe(true);
    expect(typesEqual(OCL.Real, OCL.Real)).toBe(true);
  });

  it('different primitive types are not equal', () => {
    expect(typesEqual(OCL.Integer, OCL.Real)).toBe(false);
    expect(typesEqual(OCL.String, OCL.Boolean)).toBe(false);
  });

  it('collection types with same kind and element are equal', () => {
    expect(typesEqual(OCL.SetOf(OCL.Integer), OCL.SetOf(OCL.Integer))).toBe(true);
    expect(typesEqual(OCL.BagOf(OCL.String), OCL.BagOf(OCL.String))).toBe(true);
  });

  it('collection types with different kind are not equal', () => {
    expect(typesEqual(OCL.SetOf(OCL.Integer), OCL.BagOf(OCL.Integer))).toBe(false);
  });

  it('collection types with different element type are not equal', () => {
    expect(typesEqual(OCL.SetOf(OCL.Integer), OCL.SetOf(OCL.String))).toBe(false);
  });

  it('tuple types with same parts are equal', () => {
    const t1 = OCL.Tuple([{ name: 'x', type: OCL.Integer }, { name: 'y', type: OCL.String }]);
    const t2 = OCL.Tuple([{ name: 'x', type: OCL.Integer }, { name: 'y', type: OCL.String }]);
    expect(typesEqual(t1, t2)).toBe(true);
  });

  it('tuple types with different parts are not equal', () => {
    const t1 = OCL.Tuple([{ name: 'x', type: OCL.Integer }]);
    const t2 = OCL.Tuple([{ name: 'y', type: OCL.Integer }]);
    expect(typesEqual(t1, t2)).toBe(false);
  });

  it('class types with same name are equal', () => {
    expect(typesEqual(OCL.Class('Person'), OCL.Class('Person'))).toBe(true);
  });

  it('class types with different name are not equal', () => {
    expect(typesEqual(OCL.Class('Person'), OCL.Class('Company'))).toBe(false);
  });

  it('special types are equal to themselves', () => {
    expect(typesEqual(OCL.Void, OCL.Void)).toBe(true);
    expect(typesEqual(OCL.Invalid, OCL.Invalid)).toBe(true);
    expect(typesEqual(OCL.Any, OCL.Any)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TYPE DISPLAY
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypes — typeToString', () => {
  it('primitives', () => {
    expect(typeToString(OCL.Integer)).toBe('Integer');
    expect(typeToString(OCL.String)).toBe('String');
    expect(typeToString(OCL.Real)).toBe('Real');
    expect(typeToString(OCL.Boolean)).toBe('Boolean');
  });

  it('collections', () => {
    expect(typeToString(OCL.SetOf(OCL.Integer))).toBe('Set(Integer)');
    expect(typeToString(OCL.BagOf(OCL.String))).toBe('Bag(String)');
    expect(typeToString(OCL.SequenceOf(OCL.Class('Person')))).toBe('Sequence(Person)');
  });

  it('nested collections', () => {
    expect(typeToString(OCL.SetOf(OCL.SetOf(OCL.Integer)))).toBe('Set(Set(Integer))');
  });

  it('tuples', () => {
    const t = OCL.Tuple([{ name: 'name', type: OCL.String }, { name: 'age', type: OCL.Integer }]);
    expect(typeToString(t)).toBe('Tuple(name: String, age: Integer)');
  });

  it('special types', () => {
    expect(typeToString(OCL.Void)).toBe('OclVoid');
    expect(typeToString(OCL.Invalid)).toBe('OclInvalid');
    expect(typeToString(OCL.Any)).toBe('OclAny');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CONFORMANCE RULES
// ═══════════════════════════════════════════════════════════════════════

describe('OCLConformance — conformsTo', () => {
  // Rule 1: Reflexive
  it('every type conforms to itself', () => {
    expect(conformsTo(OCL.Integer, OCL.Integer)).toBe(true);
    expect(conformsTo(OCL.String, OCL.String)).toBe(true);
    expect(conformsTo(OCL.SetOf(OCL.Integer), OCL.SetOf(OCL.Integer))).toBe(true);
    expect(conformsTo(OCL.Class('Person'), OCL.Class('Person'))).toBe(true);
  });

  // Rule: Everything conforms to OclAny
  it('all types conform to OclAny', () => {
    expect(conformsTo(OCL.Integer, OCL.Any)).toBe(true);
    expect(conformsTo(OCL.String, OCL.Any)).toBe(true);
    expect(conformsTo(OCL.SetOf(OCL.Integer), OCL.Any)).toBe(true);
    expect(conformsTo(OCL.Class('Person'), OCL.Any)).toBe(true);
    expect(conformsTo(OCL.Void, OCL.Any)).toBe(true);
    expect(conformsTo(OCL.Invalid, OCL.Any)).toBe(true);
  });

  // Rule 2: Integer conforms to Real
  it('Integer conforms to Real', () => {
    expect(conformsTo(OCL.Integer, OCL.Real)).toBe(true);
  });

  it('Real does NOT conform to Integer', () => {
    expect(conformsTo(OCL.Real, OCL.Integer)).toBe(false);
  });

  // Rule 3: UnlimitedNatural conforms to Integer (and transitively to Real)
  it('UnlimitedNatural conforms to Integer', () => {
    expect(conformsTo(OCL.UnlimitedNatural, OCL.Integer)).toBe(true);
  });

  it('UnlimitedNatural conforms to Real (transitive)', () => {
    expect(conformsTo(OCL.UnlimitedNatural, OCL.Real)).toBe(true);
  });

  // Rule 4: OclVoid conforms to all except OclInvalid
  it('OclVoid conforms to all types', () => {
    expect(conformsTo(OCL.Void, OCL.Integer)).toBe(true);
    expect(conformsTo(OCL.Void, OCL.String)).toBe(true);
    expect(conformsTo(OCL.Void, OCL.SetOf(OCL.Integer))).toBe(true);
    expect(conformsTo(OCL.Void, OCL.Class('Person'))).toBe(true);
  });

  it('OclVoid does NOT conform to OclInvalid', () => {
    expect(conformsTo(OCL.Void, OCL.Invalid)).toBe(false);
  });

  // Rule 5: OclInvalid conforms to ALL types
  it('OclInvalid conforms to all types including OclVoid', () => {
    expect(conformsTo(OCL.Invalid, OCL.Integer)).toBe(true);
    expect(conformsTo(OCL.Invalid, OCL.String)).toBe(true);
    expect(conformsTo(OCL.Invalid, OCL.Void)).toBe(true);
    expect(conformsTo(OCL.Invalid, OCL.SetOf(OCL.Integer))).toBe(true);
  });

  // Rule 7: Collection covariance
  it('Set(Integer) conforms to Set(Real) (covariance)', () => {
    expect(conformsTo(OCL.SetOf(OCL.Integer), OCL.SetOf(OCL.Real))).toBe(true);
  });

  it('Set(Real) does NOT conform to Set(Integer)', () => {
    expect(conformsTo(OCL.SetOf(OCL.Real), OCL.SetOf(OCL.Integer))).toBe(false);
  });

  it('all collection kinds conform to Collection(T)', () => {
    expect(conformsTo(OCL.SetOf(OCL.Integer), OCL.CollectionOf(OCL.Integer))).toBe(true);
    expect(conformsTo(OCL.BagOf(OCL.Integer), OCL.CollectionOf(OCL.Integer))).toBe(true);
    expect(conformsTo(OCL.SequenceOf(OCL.Integer), OCL.CollectionOf(OCL.Integer))).toBe(true);
    expect(conformsTo(OCL.OrderedSetOf(OCL.Integer), OCL.CollectionOf(OCL.Integer))).toBe(true);
  });

  it('OrderedSet conforms to Set', () => {
    expect(conformsTo(OCL.OrderedSetOf(OCL.Integer), OCL.SetOf(OCL.Integer))).toBe(true);
  });

  it('Sequence does NOT conform to Bag', () => {
    expect(conformsTo(OCL.SequenceOf(OCL.Integer), OCL.BagOf(OCL.Integer))).toBe(false);
  });

  // Rule 8: Tuple conformance
  it('tuple conforms if same parts with conforming types', () => {
    const t1 = OCL.Tuple([{ name: 'x', type: OCL.Integer }, { name: 'y', type: OCL.String }]);
    const t2 = OCL.Tuple([{ name: 'x', type: OCL.Real }, { name: 'y', type: OCL.String }]);
    expect(conformsTo(t1, t2)).toBe(true); // Integer conforms to Real
  });

  it('tuple does NOT conform if different part names', () => {
    const t1 = OCL.Tuple([{ name: 'x', type: OCL.Integer }]);
    const t2 = OCL.Tuple([{ name: 'y', type: OCL.Integer }]);
    expect(conformsTo(t1, t2)).toBe(false);
  });

  // Class conformance with hierarchy
  it('subclass conforms to superclass via hierarchy', () => {
    const hierarchy = new Map([['Student', ['Person']], ['Person', []]]);
    expect(conformsTo(OCL.Class('Student'), OCL.Class('Person'), hierarchy)).toBe(true);
  });

  it('superclass does NOT conform to subclass', () => {
    const hierarchy = new Map([['Student', ['Person']], ['Person', []]]);
    expect(conformsTo(OCL.Class('Person'), OCL.Class('Student'), hierarchy)).toBe(false);
  });

  it('transitive class conformance (grandchild)', () => {
    const hierarchy = new Map([
      ['GradStudent', ['Student']],
      ['Student', ['Person']],
      ['Person', []],
    ]);
    expect(conformsTo(OCL.Class('GradStudent'), OCL.Class('Person'), hierarchy)).toBe(true);
  });

  // Negative cases
  it('String does NOT conform to Integer', () => {
    expect(conformsTo(OCL.String, OCL.Integer)).toBe(false);
  });

  it('Boolean does NOT conform to String', () => {
    expect(conformsTo(OCL.Boolean, OCL.String)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COMMON SUPERTYPE
// ═══════════════════════════════════════════════════════════════════════

describe('OCLConformance — commonSupertype', () => {
  it('same type returns itself', () => {
    expect(typesEqual(commonSupertype(OCL.Integer, OCL.Integer), OCL.Integer)).toBe(true);
  });

  it('Integer + Real → Real', () => {
    expect(typesEqual(commonSupertype(OCL.Integer, OCL.Real), OCL.Real)).toBe(true);
    expect(typesEqual(commonSupertype(OCL.Real, OCL.Integer), OCL.Real)).toBe(true);
  });

  it('UnlimitedNatural + Integer → Integer', () => {
    expect(typesEqual(commonSupertype(OCL.UnlimitedNatural, OCL.Integer), OCL.Integer)).toBe(true);
  });

  it('UnlimitedNatural + Real → Real', () => {
    expect(typesEqual(commonSupertype(OCL.UnlimitedNatural, OCL.Real), OCL.Real)).toBe(true);
  });

  it('Set(Integer) + Set(Real) → Set(Real)', () => {
    const result = commonSupertype(OCL.SetOf(OCL.Integer), OCL.SetOf(OCL.Real));
    expect(typeToString(result)).toBe('Set(Real)');
  });

  it('Set(T) + Bag(T) → Collection(T)', () => {
    const result = commonSupertype(OCL.SetOf(OCL.Integer), OCL.BagOf(OCL.Integer));
    expect(typeToString(result)).toBe('Collection(Integer)');
  });

  it('incompatible types → OclAny', () => {
    const result = commonSupertype(OCL.String, OCL.Integer);
    expect(typesEqual(result, OCL.Any)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STANDARD LIBRARY — getOperationsForType
// ═══════════════════════════════════════════════════════════════════════

describe('OCLStandardLibrary — getOperationsForType', () => {
  it('Integer has arithmetic operations', () => {
    const ops = getOperationsForType(OCL.Integer);
    const names = ops.map((o) => o.name);
    expect(names).toContain('+');
    expect(names).toContain('-');
    expect(names).toContain('*');
    expect(names).toContain('/');
    expect(names).toContain('div');
    expect(names).toContain('mod');
    expect(names).toContain('abs');
  });

  it('String has string operations', () => {
    const ops = getOperationsForType(OCL.String);
    const names = ops.map((o) => o.name);
    expect(names).toContain('size');
    expect(names).toContain('concat');
    expect(names).toContain('substring');
    expect(names).toContain('toUpperCase');
    expect(names).toContain('toLowerCase');
    expect(names).toContain('indexOf');
    expect(names).toContain('matches');
    expect(names).toContain('trim');
    expect(names).toContain('toInteger');
  });

  it('Boolean has logical operations', () => {
    const ops = getOperationsForType(OCL.Boolean);
    const names = ops.map((o) => o.name);
    expect(names).toContain('and');
    expect(names).toContain('or');
    expect(names).toContain('not');
    expect(names).toContain('xor');
    expect(names).toContain('implies');
  });

  it('Set(T) has collection + set operations', () => {
    const ops = getOperationsForType(OCL.SetOf(OCL.Integer));
    const names = ops.map((o) => o.name);
    // Collection ops
    expect(names).toContain('size');
    expect(names).toContain('isEmpty');
    expect(names).toContain('includes');
    expect(names).toContain('forAll');
    expect(names).toContain('select');
    expect(names).toContain('collect');
    // Set-specific
    expect(names).toContain('-');
    expect(names).toContain('symmetricDifference');
    // Should NOT have ordered ops
    expect(names).not.toContain('first');
    expect(names).not.toContain('last');
    expect(names).not.toContain('at');
  });

  it('Sequence(T) has ordered operations', () => {
    const ops = getOperationsForType(OCL.SequenceOf(OCL.String));
    const names = ops.map((o) => o.name);
    expect(names).toContain('first');
    expect(names).toContain('last');
    expect(names).toContain('at');
    expect(names).toContain('indexOf');
    expect(names).toContain('append');
    expect(names).toContain('reverse');
    expect(names).toContain('subSequence');
    // Should NOT have Set-specific
    expect(names).not.toContain('symmetricDifference');
  });

  it('OrderedSet(T) has both ordered and set operations', () => {
    const ops = getOperationsForType(OCL.OrderedSetOf(OCL.Integer));
    const names = ops.map((o) => o.name);
    expect(names).toContain('first');
    expect(names).toContain('last');
    expect(names).toContain('reverse');
    expect(names).toContain('subOrderedSet');
    expect(names).toContain('-');
    expect(names).toContain('symmetricDifference');
  });

  it('all types have OclAny operations', () => {
    const ops = getOperationsForType(OCL.Class('Person'));
    const names = ops.map((o) => o.name);
    expect(names).toContain('oclIsTypeOf');
    expect(names).toContain('oclIsKindOf');
    expect(names).toContain('oclAsType');
    expect(names).toContain('oclIsUndefined');
    expect(names).toContain('oclIsInvalid');
    expect(names).toContain('toString');
  });
});
