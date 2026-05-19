/**
 * Tests — OCL Type Inference Engine
 */
import { describe, it, expect } from 'vitest';
import { OCLParser } from '../src/ocl/OCLParser.js';
import { OCLTypeInferenceEngine, MetamodelInfo } from '../src/ocl/OCLTypeInference.js';
import { OCL, typeToString } from '../src/ocl/OCLTypes.js';

// ── Test Metamodel ──────────────────────────────────────────────────

const testMetamodel: MetamodelInfo = {
  classes: [
    {
      name: 'Person',
      attributes: [
        { name: 'name', type: 'EString' },
        { name: 'age', type: 'EInt' },
        { name: 'salary', type: 'EDouble' },
        { name: 'active', type: 'EBoolean' },
      ],
      references: [
        { name: 'employer', targetClass: 'Company', many: false },
        { name: 'friends', targetClass: 'Person', many: true },
      ],
    },
    {
      name: 'Student',
      attributes: [
        { name: 'gpa', type: 'EDouble' },
      ],
      references: [
        { name: 'courses', targetClass: 'Course', many: true },
      ],
    },
    {
      name: 'Company',
      attributes: [
        { name: 'name', type: 'EString' },
        { name: 'revenue', type: 'EInt' },
      ],
      references: [
        { name: 'employees', targetClass: 'Person', many: true },
        { name: 'ceo', targetClass: 'Person', many: false },
      ],
    },
    {
      name: 'Course',
      attributes: [
        { name: 'title', type: 'EString' },
        { name: 'credits', type: 'EInt' },
      ],
      references: [],
    },
  ],
  hierarchy: new Map([
    ['Student', ['Person']],
    ['Person', []],
    ['Company', []],
    ['Course', []],
  ]),
};

// ── Helpers ─────────────────────────────────────────────────────────

const parser = new OCLParser();
const engine = new OCLTypeInferenceEngine(testMetamodel);

function inferType(expr: string, context = 'Person'): string {
  const ast = parser.parse(expr);
  const result = engine.infer(ast, context);
  return typeToString(result.type);
}

function inferErrors(expr: string, context = 'Person'): string[] {
  const ast = parser.parse(expr);
  const result = engine.infer(ast, context);
  return result.errors.map((e) => e.message);
}

// ═══════════════════════════════════════════════════════════════════════
// LITERALS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Literals', () => {
  it('integer literal', () => {
    expect(inferType('42')).toBe('Integer');
  });

  it('real literal', () => {
    expect(inferType('3.14')).toBe('Real');
  });

  it('string literal', () => {
    expect(inferType("'hello'")).toBe('String');
  });

  it('boolean literal', () => {
    expect(inferType('true')).toBe('Boolean');
    expect(inferType('false')).toBe('Boolean');
  });

  it('null literal', () => {
    expect(inferType('null')).toBe('OclVoid');
  });

  it('invalid literal', () => {
    expect(inferType('invalid')).toBe('OclInvalid');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SELF & FEATURE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Navigation', () => {
  it('self is the context class', () => {
    expect(inferType('self')).toBe('Person');
  });

  it('self.attribute → attribute type', () => {
    expect(inferType('self.name')).toBe('String');
    expect(inferType('self.age')).toBe('Integer');
    expect(inferType('self.salary')).toBe('Real');
    expect(inferType('self.active')).toBe('Boolean');
  });

  it('self.reference [1] → target class', () => {
    expect(inferType('self.employer')).toBe('Company');
  });

  it('self.reference [*] → Set(target class)', () => {
    expect(inferType('self.friends')).toBe('Set(Person)');
  });

  it('chained navigation: self.employer.name', () => {
    expect(inferType('self.employer.name')).toBe('String');
  });

  it('chained navigation: self.employer.employees', () => {
    expect(inferType('self.employer.employees')).toBe('Set(Person)');
  });

  it('implicit self: bare identifier resolves as feature', () => {
    expect(inferType('name')).toBe('String');
    expect(inferType('age')).toBe('Integer');
  });

  it('inherited feature via hierarchy', () => {
    expect(inferType('self.name', 'Student')).toBe('String');
    expect(inferType('self.age', 'Student')).toBe('Integer');
  });

  it('own feature on subclass', () => {
    expect(inferType('self.gpa', 'Student')).toBe('Real');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// IMPLICIT COLLECT
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Implicit Collect', () => {
  it('collection.attribute → Bag(attribute type)', () => {
    expect(inferType('self.friends.name')).toBe('Bag(String)');
  });

  it('collection.reference [1] → Bag(target class)', () => {
    expect(inferType('self.friends.employer')).toBe('Bag(Company)');
  });

  it('collection.reference [*] → Bag(element type) (flatten)', () => {
    expect(inferType('self.friends.friends')).toBe('Bag(Person)');
  });

  it('deep implicit collect', () => {
    // self.friends.employer.name → Bag(String)
    expect(inferType('self.friends.employer.name')).toBe('Bag(String)');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COLLECTION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Collection Operations', () => {
  it('->size() → Integer', () => {
    expect(inferType('self.friends->size()')).toBe('Integer');
  });

  it('->isEmpty() → Boolean', () => {
    expect(inferType('self.friends->isEmpty()')).toBe('Boolean');
  });

  it('->notEmpty() → Boolean', () => {
    expect(inferType('self.friends->notEmpty()')).toBe('Boolean');
  });

  it('->includes(x) → Boolean', () => {
    expect(inferType('self.friends->includes(self)')).toBe('Boolean');
  });

  it('->first() → element type', () => {
    // friends is Set, no ordered ops — but let's test with Company.employees
    expect(inferType('self.employees->first()', 'Company')).toBe('Person');
  });

  it('->select(e | cond) → same collection type', () => {
    expect(inferType('self.friends->select(f | f.age > 18)')).toBe('Set(Person)');
  });

  it('->reject(e | cond) → same collection type', () => {
    expect(inferType('self.friends->reject(f | f.active)')).toBe('Set(Person)');
  });

  it('->collect(e | expr) → Bag of expr type', () => {
    expect(inferType('self.friends->collect(f | f.name)')).toBe('Bag(String)');
  });

  it('->collect(e | expr) from Sequence → Sequence', () => {
    // OrderedSet → Sequence after collect
    // friends is Set → Bag
    expect(inferType('self.friends->collect(f | f.age)')).toBe('Bag(Integer)');
  });

  it('->forAll(e | cond) → Boolean', () => {
    expect(inferType('self.friends->forAll(f | f.age > 0)')).toBe('Boolean');
  });

  it('->exists(e | cond) → Boolean', () => {
    expect(inferType('self.friends->exists(f | f.name = self.name)')).toBe('Boolean');
  });

  it('->sortedBy(e | expr) → OrderedSet (from Set)', () => {
    expect(inferType('self.friends->sortedBy(f | f.age)')).toBe('OrderedSet(Person)');
  });

  it('->closure(e | expr) → Set', () => {
    expect(inferType('self.friends->closure(f | f.friends)')).toBe('Set(Person)');
  });

  it('->asSequence() → Sequence', () => {
    expect(inferType('self.friends->asSequence()')).toBe('Sequence(Person)');
  });

  it('->any(e | cond) → element type', () => {
    expect(inferType('self.friends->any(f | f.active)')).toBe('Person');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ARITHMETIC & LOGICAL
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Operators', () => {
  it('integer arithmetic → Integer', () => {
    expect(inferType('self.age + 1')).toBe('Integer');
    expect(inferType('self.age * 2')).toBe('Integer');
  });

  it('division → Real', () => {
    expect(inferType('self.age / 2')).toBe('Real');
  });

  it('div/mod → Integer', () => {
    expect(inferType('self.age div 2')).toBe('Integer');
    expect(inferType('self.age mod 2')).toBe('Integer');
  });

  it('string concatenation → String', () => {
    expect(inferType("self.name + ' Jr.'")).toBe('String');
  });

  it('comparison → Boolean', () => {
    expect(inferType('self.age > 18')).toBe('Boolean');
    expect(inferType('self.name = self.name')).toBe('Boolean');
  });

  it('logical operators → Boolean', () => {
    expect(inferType('self.active and true')).toBe('Boolean');
    expect(inferType('self.active or false')).toBe('Boolean');
    expect(inferType('self.active implies true')).toBe('Boolean');
    expect(inferType('not self.active')).toBe('Boolean');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LET-IN & IF-THEN-ELSE
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Let & If', () => {
  it('let binds variable type', () => {
    expect(inferType('let x : Integer = self.age in x + 1')).toBe('Integer');
  });

  it('if-then-else: common supertype of branches', () => {
    expect(inferType('if self.active then self.age else 0 endif')).toBe('Integer');
  });

  it('if-then-else: Integer + Real → Real', () => {
    expect(inferType('if true then 1 else 3.14 endif')).toBe('Real');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COLLECTION LITERALS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Collection Literals', () => {
  it('Set{1, 2, 3} → Set(Integer)', () => {
    expect(inferType('Set{1, 2, 3}')).toBe('Set(Integer)');
  });

  it('Sequence{} → Sequence(OclAny)', () => {
    expect(inferType('Sequence{}')).toBe('Sequence(OclAny)');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ERROR DETECTION
// ═══════════════════════════════════════════════════════════════════════

describe('OCLTypeInference — Error Detection', () => {
  it('unknown feature reports error', () => {
    const errors = inferErrors('self.nonExistent');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('nonExistent');
  });

  it('unknown class reports error', () => {
    const errors = inferErrors('self.name', 'UnknownClass');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('collection op on non-collection reports error', () => {
    const ast = parser.parse('self.age->size()');
    const result = engine.infer(ast, 'Person');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('non-collection');
  });
});
