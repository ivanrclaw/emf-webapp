/**
 * @emf-webapp/frontend — Expression Engine Tests
 */
import { describe, it, expect } from 'vitest';
import { evaluate, evaluateLabel, evaluatePredicate } from '../expression-engine';

describe('Expression Engine', () => {
  describe('evaluate — attribute access', () => {
    it('accesses simple property', () => {
      expect(evaluate('self.name', { self: { name: 'Person' } })).toBe('Person');
    });

    it('accesses nested property', () => {
      expect(evaluate('self.type.name', { self: { type: { name: 'EString' } } })).toBe('EString');
    });

    it('returns undefined for missing property', () => {
      expect(evaluate('self.missing', { self: { name: 'X' } })).toBeUndefined();
    });

    it('handles numeric properties', () => {
      expect(evaluate('self.age', { self: { age: 25 } })).toBe(25);
    });

    it('handles boolean properties', () => {
      expect(evaluate('self.abstract', { self: { abstract: true } })).toBe(true);
    });
  });

  describe('evaluate — collection methods', () => {
    it('size() returns array length', () => {
      expect(evaluate('self.children->size()', { self: { children: [1, 2, 3] } })).toBe(3);
    });

    it('size() returns 0 for empty array', () => {
      expect(evaluate('self.items->size()', { self: { items: [] } })).toBe(0);
    });

    it('notEmpty() returns true for non-empty', () => {
      expect(evaluate('self.refs->notEmpty()', { self: { refs: ['a'] } })).toBe(true);
    });

    it('isEmpty() returns true for empty', () => {
      expect(evaluate('self.refs->isEmpty()', { self: { refs: [] } })).toBe(true);
    });

    it('first() returns first element', () => {
      expect(evaluate('self.items->first()', { self: { items: ['a', 'b'] } })).toBe('a');
    });

    it('last() returns last element', () => {
      expect(evaluate('self.items->last()', { self: { items: ['a', 'b'] } })).toBe('b');
    });
  });

  describe('evaluate — comparisons', () => {
    it('equality with string', () => {
      expect(evaluate("self.name = 'Person'", { self: { name: 'Person' } })).toBe(true);
    });

    it('inequality', () => {
      expect(evaluate("self.name != 'Animal'", { self: { name: 'Person' } })).toBe(true);
    });

    it('greater than', () => {
      expect(evaluate('self.count > 5', { self: { count: 10 } })).toBe(true);
    });

    it('less than', () => {
      expect(evaluate('self.count < 5', { self: { count: 3 } })).toBe(true);
    });

    it('greater or equal', () => {
      expect(evaluate('self.count >= 5', { self: { count: 5 } })).toBe(true);
    });

    it('less or equal', () => {
      expect(evaluate('self.count <= 5', { self: { count: 5 } })).toBe(true);
    });
  });

  describe('evaluate — logical operators', () => {
    it('not negates', () => {
      expect(evaluate('not self.abstract', { self: { abstract: false } })).toBe(true);
    });

    it('and combines', () => {
      expect(evaluate('self.abstract and self.interface', { self: { abstract: true, interface: true } })).toBe(true);
    });

    it('and short-circuits', () => {
      expect(evaluate('self.abstract and self.interface', { self: { abstract: true, interface: false } })).toBe(false);
    });

    it('or combines', () => {
      expect(evaluate('self.abstract or self.interface', { self: { abstract: false, interface: true } })).toBe(true);
    });
  });

  describe('evaluate — string concatenation', () => {
    it('concatenates strings', () => {
      expect(evaluate("self.name + ':' + self.type", { self: { name: 'age', type: 'EInt' } })).toBe('age:EInt');
    });

    it('concatenates with numbers', () => {
      expect(evaluate("self.name + ' (' + self.count + ')'", { self: { name: 'items', count: 3 } })).toBe('items (3)');
    });
  });

  describe('evaluate — numeric addition', () => {
    it('adds numbers', () => {
      expect(evaluate('self.a + self.b', { self: { a: 3, b: 4 } })).toBe(7);
    });
  });

  describe('evaluate — literals', () => {
    it('string literal', () => {
      expect(evaluate("'hello'", { self: {} })).toBe('hello');
    });

    it('number literal', () => {
      expect(evaluate('42', { self: {} })).toBe(42);
    });

    it('boolean true', () => {
      expect(evaluate('true', { self: {} })).toBe(true);
    });

    it('boolean false', () => {
      expect(evaluate('false', { self: {} })).toBe(false);
    });
  });

  describe('evaluate — variables', () => {
    it('accesses vars', () => {
      expect(evaluate('container.name', { self: {}, vars: { container: { name: 'Root' } } })).toBe('Root');
    });
  });

  describe('evaluateLabel', () => {
    it('returns string from expression', () => {
      expect(evaluateLabel('self.name', { self: { name: 'Person' } })).toBe('Person');
    });

    it('returns empty string for null result', () => {
      expect(evaluateLabel('self.missing', { self: {} })).toBe('');
    });

    it('returns empty string for empty expression', () => {
      expect(evaluateLabel('', { self: {} })).toBe('');
    });
  });

  describe('evaluatePredicate', () => {
    it('returns true for truthy result', () => {
      expect(evaluatePredicate('self.abstract', { self: { abstract: true } })).toBe(true);
    });

    it('returns false for falsy result', () => {
      expect(evaluatePredicate('self.abstract', { self: { abstract: false } })).toBe(false);
    });

    it('returns true for empty expression (no constraint)', () => {
      expect(evaluatePredicate('', { self: {} })).toBe(true);
    });

    it('handles comparison predicates', () => {
      expect(evaluatePredicate('self.children->size() > 0', { self: { children: [1] } })).toBe(true);
    });
  });

  describe('graceful degradation', () => {
    it('parses what it can from malformed input', () => {
      // Tokenizer skips unknown chars (?, !), parses 'invalid' as identifier
      expect(evaluate('???invalid!!!', { self: {} })).toBe('invalid');
    });

    it('returns undefined for empty expression', () => {
      expect(evaluate('', { self: {} })).toBeUndefined();
    });
  });
});
