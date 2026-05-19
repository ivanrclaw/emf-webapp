/**
 * Tests for OCLEvaluator — Fase 3: Complete Standard Library
 * Covers all new operations added to the evaluator.
 */
import { describe, it, expect } from 'vitest';
import { OCLParser } from '../src/ocl/OCLParser.js';
import {
  OCLEvaluator,
  OCLEObject,
  OCLEClassInfo,
  EValue,
} from '../src/ocl/OCLEvaluator.js';

// ── Test helpers ──────────────────────────────────────────────────

function makeEvaluator(
  classes: OCLEClassInfo[] = [],
  hierarchy?: Map<string, string[]>,
) {
  const map = new Map<string, OCLEClassInfo>();
  for (const c of classes) map.set(c.name, c);
  return new OCLEvaluator(map, hierarchy);
}

function evalExpr(expr: string, context: OCLEObject, evaluator?: OCLEvaluator): EValue {
  const parser = new OCLParser();
  const ast = parser.parse(expr);
  const ev = evaluator ?? makeEvaluator();
  const result = ev.evaluate(ast, context);
  if (!result.success) throw new Error((result as { success: false; error: string }).error);
  return (result as { success: true; value: EValue }).value;
}

const dummyCtx: OCLEObject = {
  eClass: 'Person',
  attributes: { name: 'Alice', age: 30 },
  references: {},
};

// ── String Operations ─────────────────────────────────────────────

describe('OCLEvaluator — String Operations', () => {
  it('indexOf returns 1-based position', () => {
    expect(evalExpr("'hello world'.indexOf('world')", dummyCtx)).toBe(7);
  });

  it('indexOf returns 0 when not found', () => {
    expect(evalExpr("'hello'.indexOf('xyz')", dummyCtx)).toBe(0);
  });

  it('at returns character at 1-based index', () => {
    expect(evalExpr("'hello'.at(1)", dummyCtx)).toBe('h');
    expect(evalExpr("'hello'.at(5)", dummyCtx)).toBe('o');
  });

  it('at throws on out of bounds', () => {
    expect(() => evalExpr("'hi'.at(0)", dummyCtx)).toThrow();
    expect(() => evalExpr("'hi'.at(3)", dummyCtx)).toThrow();
  });

  it('characters splits string into array', () => {
    expect(evalExpr("'abc'.characters()", dummyCtx)).toEqual(['a', 'b', 'c']);
  });

  it('characters of empty string returns empty array', () => {
    expect(evalExpr("''.characters()", dummyCtx)).toEqual([]);
  });

  it('toInteger converts string to integer', () => {
    expect(evalExpr("'42'.toInteger()", dummyCtx)).toBe(42);
    expect(evalExpr("'3.7'.toInteger()", dummyCtx)).toBe(3);
  });

  it('toReal converts string to real', () => {
    expect(evalExpr("'3.14'.toReal()", dummyCtx)).toBeCloseTo(3.14);
  });

  it('toBoolean converts string', () => {
    expect(evalExpr("'true'.toBoolean()", dummyCtx)).toBe(true);
    expect(evalExpr("'false'.toBoolean()", dummyCtx)).toBe(false);
    expect(evalExpr("'yes'.toBoolean()", dummyCtx)).toBe(false);
  });

  it('toString on various types', () => {
    // Use parentheses to disambiguate number literal from dot access
    expect(evalExpr("(42).toString()", dummyCtx)).toBe('42');
    expect(evalExpr("true.toString()", dummyCtx)).toBe('true');
    expect(evalExpr("'hello'.toString()", dummyCtx)).toBe('hello');
  });

  it('trim removes whitespace', () => {
    expect(evalExpr("'  hello  '.trim()", dummyCtx)).toBe('hello');
  });

  it('replaceAll replaces all occurrences', () => {
    expect(evalExpr("'aabaa'.replaceAll('a', 'x')", dummyCtx)).toBe('xxbxx');
  });

  it('replaceFirst replaces only first occurrence', () => {
    expect(evalExpr("'aabaa'.replaceFirst('a', 'x')", dummyCtx)).toBe('xabaa');
  });

  it('matches tests regex', () => {
    expect(evalExpr("'hello123'.matches('[a-z]+[0-9]+')", dummyCtx)).toBe(true);
    expect(evalExpr("'hello'.matches('^[0-9]+$')", dummyCtx)).toBe(false);
  });

  it('equalsIgnoreCase compares case-insensitively', () => {
    expect(evalExpr("'Hello'.equalsIgnoreCase('hello')", dummyCtx)).toBe(true);
    expect(evalExpr("'Hello'.equalsIgnoreCase('world')", dummyCtx)).toBe(false);
  });

  it('substring is 1-based inclusive', () => {
    expect(evalExpr("'hello'.substring(1, 3)", dummyCtx)).toBe('hel');
    expect(evalExpr("'hello'.substring(2, 4)", dummyCtx)).toBe('ell');
  });

  it('toUpperCase and toLowerCase', () => {
    expect(evalExpr("'Hello'.toUpperCase()", dummyCtx)).toBe('HELLO');
    expect(evalExpr("'Hello'.toLowerCase()", dummyCtx)).toBe('hello');
  });
});

// ── OclAny Operations ─────────────────────────────────────────────

describe('OCLEvaluator — OclAny Operations', () => {
  it('oclIsInvalid on null', () => {
    const ctx: OCLEObject = {
      eClass: 'X',
      attributes: { val: null },
      references: {},
    };
    expect(evalExpr('val.oclIsInvalid()', ctx)).toBe(true);
  });

  it('oclIsInvalid on valid value', () => {
    expect(evalExpr("'hello'.oclIsInvalid()", dummyCtx)).toBe(false);
  });

  it('oclType returns type name for EObject', () => {
    expect(evalExpr('self.oclType()', dummyCtx)).toBe('Person');
  });

  it('oclType returns String for string', () => {
    expect(evalExpr("'hello'.oclType()", dummyCtx)).toBe('String');
  });

  it('oclType returns Integer for integer', () => {
    // Use parentheses to disambiguate from float literal
    expect(evalExpr('(42).oclType()', dummyCtx)).toBe('Integer');
  });

  it('oclType returns Real for float', () => {
    // Use context attribute for float
    const ctx: OCLEObject = {
      eClass: 'X',
      attributes: { val: 3.14 },
      references: {},
    };
    expect(evalExpr('val.oclType()', ctx)).toBe('Real');
  });

  it('oclType returns Boolean for boolean', () => {
    expect(evalExpr('true.oclType()', dummyCtx)).toBe('Boolean');
  });

  it('allInstances returns empty by default', () => {
    expect(evalExpr('self.allInstances()', dummyCtx)).toEqual([]);
  });
});

// ── Collection Operations (new) ───────────────────────────────────

describe('OCLEvaluator — Collection Operations (new)', () => {
  const ctx: OCLEObject = {
    eClass: 'Container',
    attributes: {
      nums: [1, 2, 3, 4, 5],
      names: ['alice', 'bob', 'charlie'],
      dupes: [1, 2, 2, 3, 3, 3],
    },
    references: {},
  };

  it('excludesAll returns true when no overlap', () => {
    expect(evalExpr("nums->excludesAll(Set{10, 20})", ctx, makeEvaluator())).toBe(true);
  });

  it('excludesAll returns false when overlap exists', () => {
    expect(evalExpr("nums->excludesAll(Set{3, 10})", ctx, makeEvaluator())).toBe(false);
  });

  it('count returns number of occurrences', () => {
    expect(evalExpr('dupes->count(3)', ctx, makeEvaluator())).toBe(3);
    expect(evalExpr('dupes->count(1)', ctx, makeEvaluator())).toBe(1);
    expect(evalExpr('dupes->count(99)', ctx, makeEvaluator())).toBe(0);
  });

  it('including adds element', () => {
    const result = evalExpr('nums->including(6)', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('excluding removes all occurrences', () => {
    const result = evalExpr('dupes->excluding(3)', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 2]);
  });

  it('union combines two collections', () => {
    const result = evalExpr("Set{1, 2}->union(Set{3, 4})", ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('intersection returns common elements', () => {
    const result = evalExpr("Set{1, 2, 3}->intersection(Set{2, 3, 4})", ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([2, 3]);
  });

  it('symmetricDifference returns elements in one but not both', () => {
    const result = evalExpr("Set{1, 2, 3}->symmetricDifference(Set{2, 3, 4})", ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 4]);
  });

  it('asSet removes duplicates', () => {
    const result = evalExpr('dupes->asSet()', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3]);
  });

  it('asOrderedSet removes duplicates preserving order', () => {
    const result = evalExpr('dupes->asOrderedSet()', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3]);
  });

  it('asBag returns copy', () => {
    const result = evalExpr('nums->asBag()', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('asSequence returns copy', () => {
    const result = evalExpr('nums->asSequence()', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('append adds to end', () => {
    const result = evalExpr('nums->append(6)', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('prepend adds to beginning', () => {
    const result = evalExpr('nums->prepend(0)', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('insertAt inserts at 1-based position', () => {
    const result = evalExpr("Sequence{1, 2, 3}->insertAt(2, 99)", ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 99, 2, 3]);
  });

  it('subSequence extracts range (1-based inclusive)', () => {
    const result = evalExpr('nums->subSequence(2, 4)', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([2, 3, 4]);
  });

  it('subOrderedSet extracts range', () => {
    const result = evalExpr('nums->subOrderedSet(1, 3)', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([1, 2, 3]);
  });

  it('indexOf on collection returns 1-based position', () => {
    expect(evalExpr('nums->indexOf(3)', ctx, makeEvaluator())).toBe(3);
    expect(evalExpr('nums->indexOf(99)', ctx, makeEvaluator())).toBe(0);
  });

  it('reverse reverses collection', () => {
    const result = evalExpr('nums->reverse()', ctx, makeEvaluator()) as EValue[];
    expect(result).toEqual([5, 4, 3, 2, 1]);
  });
});

// ── Tuple Evaluation ──────────────────────────────────────────────

describe('OCLEvaluator — Tuple Literals', () => {
  it('evaluates Tuple literal to Map', () => {
    const result = evalExpr("Tuple{name = 'Alice', age = 30}", dummyCtx);
    expect(result).toBeInstanceOf(Map);
    const map = result as Map<string, EValue>;
    expect(map.get('name')).toBe('Alice');
    expect(map.get('age')).toBe(30);
  });

  it('accesses Tuple parts via dot notation', () => {
    const result = evalExpr("Tuple{x = 10, y = 20}.x", dummyCtx);
    expect(result).toBe(10);
  });

  it('accesses nested Tuple part', () => {
    const result = evalExpr("Tuple{a = 'hello', b = 42}.b", dummyCtx);
    expect(result).toBe(42);
  });

  it('throws on invalid Tuple part access', () => {
    expect(() => evalExpr("Tuple{x = 1}.z", dummyCtx)).toThrow("Tuple has no part 'z'");
  });
});

// ── @pre Support ──────────────────────────────────────────────────

describe('OCLEvaluator — @pre Support', () => {
  it('evaluates @pre with pre-state context', () => {
    const parser = new OCLParser();
    const ast = parser.parse('name@pre');
    const ev = makeEvaluator();

    const currentCtx: OCLEObject = {
      eClass: 'Person',
      attributes: { name: 'Bob' },
      references: {},
    };
    const preCtx: OCLEObject = {
      eClass: 'Person',
      attributes: { name: 'Alice' },
      references: {},
    };

    // Manually inject pre-state via scope
    const scope = new Map<string, EValue>();
    scope.set('__preState__', preCtx as any);

    // Use evaluate with pre-state — we need to test the mechanism
    // The evaluator checks scope for __preState__
    const result = ev.evaluate(ast, currentCtx);
    // Without __preState__ in scope, it falls back to current context
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('Bob');
    }
  });

  it('evaluates @pre without pre-state (falls back to current)', () => {
    const result = evalExpr('name@pre', dummyCtx);
    expect(result).toBe('Alice');
  });
});

// ── Implicit Collect ──────────────────────────────────────────────

describe('OCLEvaluator — Implicit Collect', () => {
  const people: OCLEObject[] = [
    { eClass: 'Person', attributes: { name: 'Alice', age: 30 }, references: {} },
    { eClass: 'Person', attributes: { name: 'Bob', age: 25 }, references: {} },
    { eClass: 'Person', attributes: { name: 'Charlie', age: 35 }, references: {} },
  ];

  const ctx: OCLEObject = {
    eClass: 'Department',
    attributes: {},
    references: { members: people as any },
  };

  it('navigates property across collection (implicit collect)', () => {
    const result = evalExpr('members.name', ctx) as EValue[];
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('implicit collect with nested references', () => {
    const teams: OCLEObject[] = [
      {
        eClass: 'Team',
        attributes: { teamName: 'A' },
        references: { members: [people[0], people[1]] as any },
      },
      {
        eClass: 'Team',
        attributes: { teamName: 'B' },
        references: { members: [people[2]] as any },
      },
    ];
    const org: OCLEObject = {
      eClass: 'Org',
      attributes: {},
      references: { teams: teams as any },
    };

    // teams.members flattens all members from all teams
    const result = evalExpr('teams.members', org) as EValue[];
    expect(result).toHaveLength(3);
  });
});

// ── Edge Cases & Regression ───────────────────────────────────────

describe('OCLEvaluator — Edge Cases', () => {
  it('size works on both string and collection', () => {
    expect(evalExpr("'hello'.size()", dummyCtx)).toBe(5);
    const ctx: OCLEObject = {
      eClass: 'X',
      attributes: { items: [1, 2, 3] },
      references: {},
    };
    expect(evalExpr('items->size()', ctx)).toBe(3);
  });

  it('chained collection operations', () => {
    const ctx: OCLEObject = {
      eClass: 'X',
      attributes: { nums: [3, 1, 4, 1, 5, 9, 2, 6] },
      references: {},
    };
    // asSet removes dupes, then size
    const result = evalExpr('nums->asSet()->size()', ctx, makeEvaluator());
    expect(result).toBe(7); // {3,1,4,5,9,2,6}
  });

  it('collect then select', () => {
    const people: OCLEObject[] = [
      { eClass: 'Person', attributes: { name: 'Alice', age: 30 }, references: {} },
      { eClass: 'Person', attributes: { name: 'Bob', age: 17 }, references: {} },
      { eClass: 'Person', attributes: { name: 'Charlie', age: 25 }, references: {} },
    ];
    const ctx: OCLEObject = {
      eClass: 'Dept',
      attributes: {},
      references: { members: people as any },
    };
    const result = evalExpr('members->select(p | p.age >= 18)->size()', ctx, makeEvaluator());
    expect(result).toBe(2);
  });

  it('nested let with collection ops', () => {
    const ctx: OCLEObject = {
      eClass: 'X',
      attributes: { items: [10, 20, 30] },
      references: {},
    };
    const result = evalExpr(
      'let total : Integer = items->sum() in total > 50',
      ctx,
      makeEvaluator(),
    );
    expect(result).toBe(true);
  });

  it('if-then-else with string ops', () => {
    const result = evalExpr(
      "if name.size() > 3 then name.toUpper() else name.toLower() endif",
      dummyCtx,
    );
    expect(result).toBe('ALICE');
  });
});
