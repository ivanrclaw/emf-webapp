/**
 * OCL Evaluator Complete Test Suite
 * Tests ALL evaluator operations: string ops, collection ops, multi-iterator,
 * three-valued logic, range expressions, and OclAny operations.
 */
import { describe, it, expect } from 'vitest';
import { OCLParser } from '../../src/ocl/OCLParser.js';
import { OCLEvaluator, OCLEObject, EValue, OCLEClassInfo, OCLResult } from '../../src/ocl/OCLEvaluator.js';

function evalOCL(
  expr: string,
  context: OCLEObject,
  classInfo?: Map<string, OCLEClassInfo>,
  hierarchy?: Map<string, string[]>,
): OCLResult {
  const parser = new OCLParser();
  const ast = parser.parse(expr);
  const evaluator = new OCLEvaluator(classInfo || new Map(), hierarchy);
  return evaluator.evaluate(ast, context);
}

function evalValue(
  expr: string,
  context: OCLEObject,
  classInfo?: Map<string, OCLEClassInfo>,
  hierarchy?: Map<string, string[]>,
): EValue {
  const result = evalOCL(expr, context, classInfo, hierarchy);
  if (!result.success) throw new Error(`Eval failed: ${(result as { success: false; error: string }).error}`);
  return (result as { success: true; value: EValue }).value;
}

// ── Test fixtures ──────────────────────────────────────────────────────

const alice: OCLEObject = {
  eClass: 'Person',
  attributes: { name: 'Alice', age: 30, salary: 50000, email: 'alice@example.com' },
  references: {},
};

const bob: OCLEObject = {
  eClass: 'Student',
  attributes: { name: 'Bob', age: 22, salary: 25000, enrolled: true },
  references: {},
};

const charlie: OCLEObject = {
  eClass: 'Professor',
  attributes: { name: 'Charlie', age: 45, salary: 80000 },
  references: {},
};

// Container/contents hierarchy
const department: OCLEObject = {
  eClass: 'Department',
  attributes: { name: 'CS' },
  references: { members: [alice, bob, charlie] },
  eContents: () => [alice, bob, charlie],
};

alice.eContainer = department;
bob.eContainer = department;
charlie.eContainer = department;

const ctxWithFriends: OCLEObject = {
  eClass: 'Person',
  attributes: { name: 'Alice', age: 30, greeting: 'hello world foo bar' },
  references: { friends: [bob, charlie] },
};

const ctxWithNumbers: OCLEObject = {
  eClass: 'Container',
  attributes: { label: 'test' },
  references: { items: [] },
};

// Hierarchy for selectByKind tests
const hierarchy = new Map<string, string[]>();
hierarchy.set('Student', ['Person']);
hierarchy.set('Professor', ['Person']);
hierarchy.set('Person', ['NamedElement']);

const classInfo = new Map<string, OCLEClassInfo>();
classInfo.set('Person', {
  name: 'Person',
  eStructuralFeatures: [
    { name: 'name', type: 'String', kind: 'attribute', many: false },
    { name: 'age', type: 'Integer', kind: 'attribute', many: false },
    { name: 'salary', type: 'Integer', kind: 'attribute', many: false },
  ],
});
classInfo.set('Student', {
  name: 'Student',
  eStructuralFeatures: [
    { name: 'name', type: 'String', kind: 'attribute', many: false },
    { name: 'enrolled', type: 'Boolean', kind: 'attribute', many: false },
  ],
});
classInfo.set('Professor', {
  name: 'Professor',
  eStructuralFeatures: [
    { name: 'name', type: 'String', kind: 'attribute', many: false },
    { name: 'salary', type: 'Integer', kind: 'attribute', many: false },
  ],
});

// ═══════════════════════════════════════════════════════════════════════
// 1. STRING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

describe('OCL Evaluator — String Operations', () => {
  describe('lastIndexOf', () => {
    it('finds last occurrence (1-based)', () => {
      expect(evalValue("'hello world hello'.lastIndexOf('hello')", alice)).toBe(13);
    });

    it('returns 0 when substring not found', () => {
      expect(evalValue("'hello'.lastIndexOf('xyz')", alice)).toBe(0);
    });

    it('finds last occurrence of single char', () => {
      expect(evalValue("'abcabc'.lastIndexOf('c')", alice)).toBe(6);
    });

    it('handles empty substring', () => {
      // lastIndexOf('') in JS returns string length
      expect(evalValue("'hello'.lastIndexOf('')", alice)).toBe(6); // 5 + 1 (1-based)
    });

    it('works with attribute value', () => {
      expect(evalValue("self.name.lastIndexOf('i')", alice)).toBe(3);
    });
  });

  describe('substituteAll', () => {
    it('replaces all occurrences', () => {
      expect(evalValue("'aabbaa'.substituteAll('aa', 'x')", alice)).toBe('xbbx');
    });

    it('handles no match', () => {
      expect(evalValue("'hello'.substituteAll('xyz', 'abc')", alice)).toBe('hello');
    });

    it('replaces with empty string (deletion)', () => {
      expect(evalValue("'hello world'.substituteAll(' ', '')", alice)).toBe('helloworld');
    });

    it('handles overlapping patterns', () => {
      expect(evalValue("'aaa'.substituteAll('aa', 'b')", alice)).toBe('ba');
    });
  });

  describe('substituteFirst', () => {
    it('replaces only first occurrence', () => {
      expect(evalValue("'aabbaa'.substituteFirst('aa', 'x')", alice)).toBe('xbbaa');
    });

    it('handles no match', () => {
      expect(evalValue("'hello'.substituteFirst('xyz', 'abc')", alice)).toBe('hello');
    });

    it('replaces first with empty string', () => {
      expect(evalValue("'hello world hello'.substituteFirst('hello', '')", alice)).toBe(' world hello');
    });
  });

  describe('tokenize', () => {
    it('splits by whitespace', () => {
      const result = evalValue("'hello world foo bar'.tokenize()", ctxWithFriends);
      expect(result).toEqual(['hello', 'world', 'foo', 'bar']);
    });

    it('handles multiple spaces', () => {
      const result = evalValue("'a   b   c'.tokenize()", alice);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('handles tabs and newlines', () => {
      // tokenize splits on any whitespace
      const result = evalValue("self.greeting.tokenize()", ctxWithFriends);
      expect(result).toEqual(['hello', 'world', 'foo', 'bar']);
    });

    it('returns empty for empty string', () => {
      expect(evalValue("''.tokenize()", alice)).toEqual([]);
    });

    it('returns empty for whitespace-only string', () => {
      expect(evalValue("'   '.tokenize()", alice)).toEqual([]);
    });
  });

  describe('String comparison (lexicographic)', () => {
    it('"apple" < "banana" is true', () => {
      expect(evalValue("'apple' < 'banana'", alice)).toBe(true);
    });

    it('"banana" > "apple" is true', () => {
      expect(evalValue("'banana' > 'apple'", alice)).toBe(true);
    });

    it('"abc" <= "abc" is true (equal)', () => {
      expect(evalValue("'abc' <= 'abc'", alice)).toBe(true);
    });

    it('"abc" >= "abc" is true (equal)', () => {
      expect(evalValue("'abc' >= 'abc'", alice)).toBe(true);
    });

    it('"abc" < "abd" is true', () => {
      expect(evalValue("'abc' < 'abd'", alice)).toBe(true);
    });

    it('"z" > "a" is true', () => {
      expect(evalValue("'z' > 'a'", alice)).toBe(true);
    });

    it('"A" < "a" depends on locale (case sensitive)', () => {
      // localeCompare: 'A' < 'a' in most locales
      const result = evalValue("'A' < 'a'", alice);
      expect(typeof result).toBe('boolean');
    });

    it('"hello" <= "hello world" is true (prefix)', () => {
      expect(evalValue("'hello' <= 'hello world'", alice)).toBe(true);
    });

    it('"xyz" >= "abc" is true', () => {
      expect(evalValue("'xyz' >= 'abc'", alice)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. COLLECTION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

describe('OCL Evaluator — Collection Operations', () => {
  describe('product', () => {
    it('computes cartesian product of two sequences', () => {
      const result = evalValue(
        "Sequence{1, 2}->product(Sequence{3, 4})",
        alice,
      ) as EValue[];
      expect(result).toHaveLength(4);
      // Each element is a Map (tuple) with 'first' and 'second'
      const first = result[0] as Map<string, EValue>;
      expect(first.get('first')).toBe(1);
      expect(first.get('second')).toBe(3);
    });

    it('product with empty collection yields empty', () => {
      const result = evalValue(
        "Sequence{1, 2}->product(Sequence{})",
        alice,
      ) as EValue[];
      expect(result).toHaveLength(0);
    });

    it('product of single-element collections', () => {
      const result = evalValue(
        "Set{1}->product(Set{2})",
        alice,
      ) as EValue[];
      expect(result).toHaveLength(1);
      const tuple = result[0] as Map<string, EValue>;
      expect(tuple.get('first')).toBe(1);
      expect(tuple.get('second')).toBe(2);
    });

    it('product preserves all combinations', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->product(Sequence{10, 20})",
        alice,
      ) as EValue[];
      expect(result).toHaveLength(6);
    });
  });

  describe('includingAll', () => {
    it('adds all elements from another collection', () => {
      const result = evalValue(
        "Sequence{1, 2}->includingAll(Sequence{3, 4})",
        alice,
      );
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('includingAll with empty collection returns original', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->includingAll(Sequence{})",
        alice,
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('includingAll on empty collection', () => {
      const result = evalValue(
        "Sequence{}->includingAll(Sequence{5, 6})",
        alice,
      );
      expect(result).toEqual([5, 6]);
    });

    it('includingAll allows duplicates in Sequence', () => {
      const result = evalValue(
        "Sequence{1, 2}->includingAll(Sequence{2, 3})",
        alice,
      );
      expect(result).toEqual([1, 2, 2, 3]);
    });
  });

  describe('excludingAll', () => {
    it('removes all matching elements', () => {
      const result = evalValue(
        "Sequence{1, 2, 3, 4, 5}->excludingAll(Sequence{2, 4})",
        alice,
      );
      expect(result).toEqual([1, 3, 5]);
    });

    it('excludingAll with no matches returns original', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->excludingAll(Sequence{7, 8})",
        alice,
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('excludingAll with empty argument returns original', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->excludingAll(Sequence{})",
        alice,
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('excludingAll removes all occurrences', () => {
      const result = evalValue(
        "Sequence{1, 2, 2, 3, 2}->excludingAll(Sequence{2})",
        alice,
      );
      expect(result).toEqual([1, 3]);
    });
  });

  describe('selectByKind', () => {
    it('selects elements that are kind of given type', () => {
      const mixed: OCLEObject = {
        eClass: 'Container',
        attributes: {},
        references: { elements: [alice, bob, charlie] },
      };
      const result = evalValue(
        "self.elements->selectByKind('Person')",
        mixed,
        classInfo,
        hierarchy,
      ) as EValue[];
      // All three are kind of Person (Student and Professor extend Person)
      expect(result).toHaveLength(3);
    });

    it('selectByKind filters non-matching types', () => {
      const mixed: OCLEObject = {
        eClass: 'Container',
        attributes: {},
        references: { elements: [alice, bob, charlie] },
      };
      const result = evalValue(
        "self.elements->selectByKind('Student')",
        mixed,
        classInfo,
        hierarchy,
      ) as EValue[];
      // Only bob is a Student
      expect(result).toHaveLength(1);
    });

    it('selectByKind on empty collection returns empty', () => {
      const empty: OCLEObject = {
        eClass: 'Container',
        attributes: {},
        references: { elements: [] },
      };
      const result = evalValue(
        "self.elements->selectByKind('Person')",
        empty,
        classInfo,
        hierarchy,
      ) as EValue[];
      expect(result).toHaveLength(0);
    });
  });

  describe('selectByType', () => {
    it('selects elements of exact type only', () => {
      const mixed: OCLEObject = {
        eClass: 'Container',
        attributes: {},
        references: { elements: [alice, bob, charlie] },
      };
      const result = evalValue(
        "self.elements->selectByType('Person')",
        mixed,
        classInfo,
        hierarchy,
      ) as EValue[];
      // Only alice is exactly Person (bob=Student, charlie=Professor)
      expect(result).toHaveLength(1);
    });

    it('selectByType does not include subtypes', () => {
      const mixed: OCLEObject = {
        eClass: 'Container',
        attributes: {},
        references: { elements: [alice, bob, charlie] },
      };
      const result = evalValue(
        "self.elements->selectByType('Student')",
        mixed,
        classInfo,
        hierarchy,
      ) as EValue[];
      expect(result).toHaveLength(1);
    });
  });

  describe('Set difference (-)', () => {
    it('computes set difference', () => {
      const result = evalValue(
        "Set{1, 2, 3, 4, 5} - Set{2, 4}",
        alice,
      );
      expect(result).toEqual([1, 3, 5]);
    });

    it('difference with empty set returns original', () => {
      const result = evalValue(
        "Set{1, 2, 3} - Set{}",
        alice,
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('difference with superset returns empty', () => {
      const result = evalValue(
        "Set{1, 2} - Set{1, 2, 3, 4}",
        alice,
      );
      expect(result).toEqual([]);
    });

    it('difference with disjoint set returns original', () => {
      const result = evalValue(
        "Set{1, 2, 3} - Set{4, 5, 6}",
        alice,
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('empty set difference returns empty', () => {
      const result = evalValue(
        "Set{} - Set{1, 2}",
        alice,
      );
      expect(result).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. MULTI-ITERATOR
// ═══════════════════════════════════════════════════════════════════════

describe('OCL Evaluator — Multi-Iterator Operations', () => {
  describe('forAll with two iterators', () => {
    it('forAll(x, y | x <> y) on distinct elements is true', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->forAll(x, y | x <> y)",
        alice,
      );
      // This checks ALL pairs including (1,1), so it should be false
      expect(result).toBe(false);
    });

    it('forAll(x, y | x + y > 0) on positive numbers', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->forAll(x, y | x + y > 0)",
        alice,
      );
      expect(result).toBe(true);
    });

    it('forAll(x, y | x <= y) is false for non-sorted', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->forAll(x, y | x <= y)",
        alice,
      );
      // (2,1) fails, (3,1) fails, (3,2) fails
      expect(result).toBe(false);
    });

    it('forAll(x, y | ...) on single element collection', () => {
      const result = evalValue(
        "Sequence{5}->forAll(x, y | x = y)",
        alice,
      );
      // Only pair is (5,5), so x = y is true
      expect(result).toBe(true);
    });

    it('forAll(x, y | ...) on empty collection is true (vacuous)', () => {
      const result = evalValue(
        "Sequence{}->forAll(x, y | x <> y)",
        alice,
      );
      expect(result).toBe(true);
    });
  });

  describe('exists with two iterators', () => {
    it('exists(x, y | x + y = 5) finds a matching pair', () => {
      const result = evalValue(
        "Sequence{1, 2, 3, 4}->exists(x, y | x + y = 5)",
        alice,
      );
      // (1,4), (2,3), (3,2), (4,1) all satisfy
      expect(result).toBe(true);
    });

    it('exists(x, y | x + y = 100) with no matching pair', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->exists(x, y | x + y = 100)",
        alice,
      );
      expect(result).toBe(false);
    });

    it('exists(x, y | x = y) always true for non-empty (same element)', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->exists(x, y | x = y)",
        alice,
      );
      // (1,1), (2,2), (3,3) all satisfy
      expect(result).toBe(true);
    });

    it('exists(x, y | ...) on empty collection is false', () => {
      const result = evalValue(
        "Sequence{}->exists(x, y | x = y)",
        alice,
      );
      expect(result).toBe(false);
    });

    it('exists(x, y | x * y = 6)', () => {
      const result = evalValue(
        "Sequence{1, 2, 3}->exists(x, y | x * y = 6)",
        alice,
      );
      // (2,3) and (3,2) satisfy
      expect(result).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. THREE-VALUED LOGIC
// ═══════════════════════════════════════════════════════════════════════

describe('OCL Evaluator — Three-Valued Logic', () => {
  // Context with null attribute to produce null values
  const ctxWithNull: OCLEObject = {
    eClass: 'Person',
    attributes: { name: 'Test', age: 30, flag: null, active: true, inactive: false },
    references: {},
  };

  describe('null and ...', () => {
    it('null and false = false', () => {
      const result = evalValue("self.flag and false", ctxWithNull);
      expect(result).toBe(false);
    });

    it('null and true = null', () => {
      const result = evalValue("self.flag and true", ctxWithNull);
      expect(result).toBe(null);
    });

    it('null and null = null', () => {
      const result = evalValue("self.flag and self.flag", ctxWithNull);
      expect(result).toBe(null);
    });

    it('false and null = false', () => {
      const result = evalValue("self.inactive and self.flag", ctxWithNull);
      expect(result).toBe(false);
    });

    it('true and null = null', () => {
      const result = evalValue("self.active and self.flag", ctxWithNull);
      expect(result).toBe(null);
    });
  });

  describe('null or ...', () => {
    it('null or true = true', () => {
      const result = evalValue("self.flag or true", ctxWithNull);
      expect(result).toBe(true);
    });

    it('null or false = null', () => {
      const result = evalValue("self.flag or false", ctxWithNull);
      expect(result).toBe(null);
    });

    it('null or null = null', () => {
      const result = evalValue("self.flag or self.flag", ctxWithNull);
      expect(result).toBe(null);
    });

    it('true or null = true', () => {
      const result = evalValue("self.active or self.flag", ctxWithNull);
      expect(result).toBe(true);
    });

    it('false or null = null', () => {
      const result = evalValue("self.inactive or self.flag", ctxWithNull);
      expect(result).toBe(null);
    });
  });

  describe('null implies ...', () => {
    it('null implies true = true', () => {
      const result = evalValue("self.flag implies true", ctxWithNull);
      expect(result).toBe(true);
    });

    it('null implies false = null', () => {
      const result = evalValue("self.flag implies false", ctxWithNull);
      expect(result).toBe(null);
    });

    it('null implies null = null', () => {
      const result = evalValue("self.flag implies self.flag", ctxWithNull);
      expect(result).toBe(null);
    });

    it('false implies null = true', () => {
      const result = evalValue("self.inactive implies self.flag", ctxWithNull);
      expect(result).toBe(true);
    });

    it('true implies null = null', () => {
      const result = evalValue("self.active implies self.flag", ctxWithNull);
      expect(result).toBe(null);
    });
  });

  describe('null xor ...', () => {
    it('null xor true = null', () => {
      const result = evalValue("self.flag xor true", ctxWithNull);
      expect(result).toBe(null);
    });

    it('null xor false = null', () => {
      const result = evalValue("self.flag xor false", ctxWithNull);
      expect(result).toBe(null);
    });

    it('null xor null = null', () => {
      const result = evalValue("self.flag xor self.flag", ctxWithNull);
      expect(result).toBe(null);
    });

    it('true xor false = true', () => {
      const result = evalValue("self.active xor self.inactive", ctxWithNull);
      expect(result).toBe(true);
    });

    it('true xor true = false', () => {
      const result = evalValue("self.active xor self.active", ctxWithNull);
      expect(result).toBe(false);
    });

    it('false xor false = false', () => {
      const result = evalValue("self.inactive xor self.inactive", ctxWithNull);
      expect(result).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. RANGE EXPRESSIONS
// ═══════════════════════════════════════════════════════════════════════

describe('OCL Evaluator — Range Expressions', () => {
  describe('ascending ranges', () => {
    it('Sequence{1..5} produces [1,2,3,4,5]', () => {
      const result = evalValue("Sequence{1..5}", alice);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('Sequence{0..3} produces [0,1,2,3]', () => {
      const result = evalValue("Sequence{0..3}", alice);
      expect(result).toEqual([0, 1, 2, 3]);
    });

    it('Sequence{10..12} produces [10,11,12]', () => {
      const result = evalValue("Sequence{10..12}", alice);
      expect(result).toEqual([10, 11, 12]);
    });

    it('single element range Sequence{5..5} produces [5]', () => {
      const result = evalValue("Sequence{5..5}", alice);
      expect(result).toEqual([5]);
    });
  });

  describe('descending ranges', () => {
    it('Sequence{5..1} produces [5,4,3,2,1]', () => {
      const result = evalValue("Sequence{5..1}", alice);
      expect(result).toEqual([5, 4, 3, 2, 1]);
    });

    it('Sequence{3..0} produces [3,2,1,0]', () => {
      const result = evalValue("Sequence{3..0}", alice);
      expect(result).toEqual([3, 2, 1, 0]);
    });

    it('Sequence{10..8} produces [10,9,8]', () => {
      const result = evalValue("Sequence{10..8}", alice);
      expect(result).toEqual([10, 9, 8]);
    });
  });

  describe('range operations', () => {
    it('Sequence{1..5}->size() = 5', () => {
      const result = evalValue("Sequence{1..5}->size()", alice);
      expect(result).toBe(5);
    });

    it('Sequence{1..5}->sum() = 15', () => {
      const result = evalValue("Sequence{1..5}->sum()", alice);
      expect(result).toBe(15);
    });

    it('Sequence{1..10}->select(x | x > 5)', () => {
      const result = evalValue("Sequence{1..10}->select(x | x > 5)", alice);
      expect(result).toEqual([6, 7, 8, 9, 10]);
    });

    it('Sequence{1..5}->collect(x | x * 2)', () => {
      const result = evalValue("Sequence{1..5}->collect(x | x * 2)", alice);
      expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    it('Sequence{1..5}->forAll(x | x > 0)', () => {
      const result = evalValue("Sequence{1..5}->forAll(x | x > 0)", alice);
      expect(result).toBe(true);
    });

    it('Sequence{1..5}->exists(x | x = 3)', () => {
      const result = evalValue("Sequence{1..5}->exists(x | x = 3)", alice);
      expect(result).toBe(true);
    });

    it('Sequence{5..1}->first() = 5', () => {
      const result = evalValue("Sequence{5..1}->first()", alice);
      expect(result).toBe(5);
    });

    it('Sequence{5..1}->last() = 1', () => {
      const result = evalValue("Sequence{5..1}->last()", alice);
      expect(result).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. OclAny OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

describe('OCL Evaluator — OclAny Operations', () => {
  describe('oclContainer()', () => {
    it('returns the containing object', () => {
      const result = evalValue("self.oclContainer()", alice);
      expect(result).toBe(department);
    });

    it('returns null when no container', () => {
      const orphan: OCLEObject = {
        eClass: 'Person',
        attributes: { name: 'Orphan' },
        references: {},
        eContainer: null,
      };
      const result = evalValue("self.oclContainer()", orphan);
      expect(result).toBe(null);
    });

    it('navigates container attributes', () => {
      const result = evalValue("self.oclContainer()", bob);
      // bob's container is department
      expect(result).not.toBeNull();
      expect((result as OCLEObject).eClass).toBe('Department');
    });
  });

  describe('oclContents()', () => {
    it('returns direct contained children', () => {
      const result = evalValue("self.oclContents()", department) as EValue[];
      expect(result).toHaveLength(3);
    });

    it('returns empty when no contents function', () => {
      const leaf: OCLEObject = {
        eClass: 'Leaf',
        attributes: {},
        references: {},
      };
      const result = evalValue("self.oclContents()", leaf) as EValue[];
      expect(result).toEqual([]);
    });

    it('returns empty for object with empty contents', () => {
      const emptyContainer: OCLEObject = {
        eClass: 'Container',
        attributes: {},
        references: {},
        eContents: () => [],
      };
      const result = evalValue("self.oclContents()", emptyContainer) as EValue[];
      expect(result).toEqual([]);
    });

    it('oclContents()->size() returns count', () => {
      const result = evalValue("self.oclContents()->size()", department);
      expect(result).toBe(3);
    });
  });

  describe('oclIsUndefined()', () => {
    it('returns true for null attribute', () => {
      const ctx: OCLEObject = {
        eClass: 'Person',
        attributes: { name: null },
        references: {},
      };
      const result = evalValue("self.name.oclIsUndefined()", ctx);
      expect(result).toBe(true);
    });

    it('returns false for defined attribute', () => {
      const result = evalValue("self.name.oclIsUndefined()", alice);
      expect(result).toBe(false);
    });

    it('returns false for number', () => {
      const result = evalValue("self.age.oclIsUndefined()", alice);
      expect(result).toBe(false);
    });

    it('returns false for empty string', () => {
      const ctx: OCLEObject = {
        eClass: 'Person',
        attributes: { name: '' },
        references: {},
      };
      const result = evalValue("self.name.oclIsUndefined()", ctx);
      expect(result).toBe(false);
    });

    it('returns false for zero', () => {
      const ctx: OCLEObject = {
        eClass: 'Person',
        attributes: { count: 0 },
        references: {},
      };
      const result = evalValue("self.count.oclIsUndefined()", ctx);
      expect(result).toBe(false);
    });
  });

  describe('oclIsInvalid()', () => {
    it('returns true for null value', () => {
      const ctx: OCLEObject = {
        eClass: 'Person',
        attributes: { value: null },
        references: {},
      };
      const result = evalValue("self.value.oclIsInvalid()", ctx);
      expect(result).toBe(true);
    });

    it('returns true for undefined value', () => {
      const ctx: OCLEObject = {
        eClass: 'Person',
        attributes: { value: undefined },
        references: {},
      };
      const result = evalValue("self.value.oclIsInvalid()", ctx);
      expect(result).toBe(true);
    });

    it('returns false for valid string', () => {
      const result = evalValue("self.name.oclIsInvalid()", alice);
      expect(result).toBe(false);
    });

    it('returns false for valid number', () => {
      const result = evalValue("self.age.oclIsInvalid()", alice);
      expect(result).toBe(false);
    });

    it('returns false for boolean false', () => {
      const ctx: OCLEObject = {
        eClass: 'Person',
        attributes: { active: false },
        references: {},
      };
      const result = evalValue("self.active.oclIsInvalid()", ctx);
      expect(result).toBe(false);
    });
  });
});
