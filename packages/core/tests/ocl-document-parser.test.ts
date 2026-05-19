/**
 * Tests — OCL Document Parser (Complete OCL)
 */
import { describe, it, expect } from 'vitest';
import { OCLDocumentParser } from '../src/ocl/OCLDocumentParser.js';

const parser = new OCLDocumentParser();

// ═══════════════════════════════════════════════════════════════════════
// BASIC DOCUMENT STRUCTURE
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Basic Structure', () => {
  it('parses empty document', () => {
    const result = parser.parse('');
    expect(result.document.declarations).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('parses single classifier context with invariant', () => {
    const input = `
      context Person
        inv: self.age > 0
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.document.declarations).toHaveLength(1);
    const ctx = result.document.declarations[0];
    expect(ctx.type).toBe('context');
    if (ctx.type === 'context') {
      expect(ctx.kind).toBe('classifier');
      expect(ctx.className).toBe('Person');
      expect(ctx.constraints).toHaveLength(1);
      expect(ctx.constraints[0].type).toBe('invariant');
    }
  });

  it('parses named invariant', () => {
    const input = `
      context Person
        inv positiveAge: self.age > 0
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      const inv = ctx.constraints[0];
      if (inv.type === 'invariant') {
        expect(inv.name).toBe('positiveAge');
      }
    }
  });

  it('parses multiple invariants in one context', () => {
    const input = `
      context Person
        inv: self.age > 0
        inv: self.name.size() > 0
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      expect(ctx.constraints).toHaveLength(2);
    }
  });

  it('parses multiple contexts', () => {
    const input = `
      context Person
        inv: self.age > 0

      context Company
        inv: self.employees->notEmpty()
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.document.declarations).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PACKAGE DECLARATIONS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Packages', () => {
  it('parses package with context', () => {
    const input = `
      package mymodel
        context Person
          inv: self.age >= 0
      endpackage
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.document.declarations).toHaveLength(1);
    const pkg = result.document.declarations[0];
    expect(pkg.type).toBe('package');
    if (pkg.type === 'package') {
      expect(pkg.name).toBe('mymodel');
      expect(pkg.contexts).toHaveLength(1);
    }
  });

  it('parses qualified package name', () => {
    const input = `
      package org::example::model
        context Person
          inv: true
      endpackage
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const pkg = result.document.declarations[0];
    if (pkg.type === 'package') {
      expect(pkg.name).toBe('org::example::model');
    }
  });

  it('parses multiple contexts in package', () => {
    const input = `
      package hr
        context Person
          inv: self.age > 0
        context Company
          inv: self.name.size() > 0
      endpackage
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const pkg = result.document.declarations[0];
    if (pkg.type === 'package') {
      expect(pkg.contexts).toHaveLength(2);
    }
  });

  it('reports error for missing endpackage', () => {
    const input = `
      package mymodel
        context Person
          inv: true
    `;
    const result = parser.parse(input);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('endpackage');
  });

  it('parses package followed by standalone context', () => {
    const input = `
      package hr
        context Person
          inv: true
      endpackage

      context Company
        inv: self.name.size() > 0
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.document.declarations).toHaveLength(2);
    expect(result.document.declarations[0].type).toBe('package');
    expect(result.document.declarations[1].type).toBe('context');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// OPERATION CONTEXT
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Operation Context', () => {
  it('parses operation context with pre/post', () => {
    const input = `
      context Person::setAge(newAge: Integer) : Integer
        pre: newAge > 0
        post: self.age = newAge
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      expect(ctx.kind).toBe('operation');
      expect(ctx.className).toBe('Person');
      expect(ctx.operationName).toBe('setAge');
      expect(ctx.operationParams).toHaveLength(1);
      expect(ctx.operationParams![0]).toEqual({ name: 'newAge', type: 'Integer' });
      expect(ctx.returnType).toBe('Integer');
      expect(ctx.constraints).toHaveLength(2);
      expect(ctx.constraints[0].type).toBe('precondition');
      expect(ctx.constraints[1].type).toBe('postcondition');
    }
  });

  it('parses operation with multiple params', () => {
    const input = `
      context Person::transfer(amount: Real, target: Person) : Boolean
        pre: amount > 0
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      expect(ctx.operationParams).toHaveLength(2);
      expect(ctx.operationParams![0]).toEqual({ name: 'amount', type: 'Real' });
      expect(ctx.operationParams![1]).toEqual({ name: 'target', type: 'Person' });
    }
  });

  it('parses operation with no params', () => {
    const input = `
      context Person::getName() : String
        body: self.name
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      expect(ctx.operationParams).toHaveLength(0);
      expect(ctx.returnType).toBe('String');
      expect(ctx.constraints[0].type).toBe('body');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PROPERTY CONTEXT
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Property Context', () => {
  it('parses property context with init', () => {
    const input = `
      context Person::age : Integer
        init: 0
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      expect(ctx.kind).toBe('property');
      expect(ctx.className).toBe('Person');
      expect(ctx.propertyName).toBe('age');
      expect(ctx.returnType).toBe('Integer');
      expect(ctx.constraints[0].type).toBe('init');
    }
  });

  it('parses property context with derive', () => {
    const input = `
      context Person::fullName : String
        derive: self.firstName.concat(' ').concat(self.lastName)
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      expect(ctx.kind).toBe('property');
      expect(ctx.constraints[0].type).toBe('derive');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DEF HELPERS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Def Helpers', () => {
  it('parses attribute def', () => {
    const input = `
      context Person
        def: isAdult : Boolean = self.age >= 18
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      const def = ctx.constraints[0];
      if (def.type === 'def') {
        expect(def.name).toBe('isAdult');
        expect(def.returnType).toBe('Boolean');
        expect(def.params).toBeUndefined();
      }
    }
  });

  it('parses operation def', () => {
    const input = `
      context Person
        def: income(tax: Real) : Real = self.salary * (1 - tax)
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      const def = ctx.constraints[0];
      if (def.type === 'def') {
        expect(def.name).toBe('income');
        expect(def.params).toHaveLength(1);
        expect(def.params![0]).toEqual({ name: 'tax', type: 'Real' });
        expect(def.returnType).toBe('Real');
      }
    }
  });

  it('parses def with collection return type', () => {
    const input = `
      context Company
        def: seniorEmployees() : Set(Person) = self.employees->select(e | e.age > 50)
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      const def = ctx.constraints[0];
      if (def.type === 'def') {
        expect(def.name).toBe('seniorEmployees');
        expect(def.returnType).toBe('Set(Person)');
      }
    }
  });

  it('parses multiple defs', () => {
    const input = `
      context Person
        def: isAdult : Boolean = self.age >= 18
        def: isRetired : Boolean = self.age >= 65
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      expect(ctx.constraints).toHaveLength(2);
      expect(ctx.constraints[0].type).toBe('def');
      expect(ctx.constraints[1].type).toBe('def');
    }
  });

  it('parses def without explicit return type', () => {
    const input = `
      context Person
        def: greeting = 'Hello'
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      const def = ctx.constraints[0];
      if (def.type === 'def') {
        expect(def.name).toBe('greeting');
        expect(def.returnType).toBeUndefined();
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COMPLEX EXPRESSIONS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Complex Expressions', () => {
  it('parses invariant with collection operations', () => {
    const input = `
      context Company
        inv: self.employees->forAll(e | e.age >= 18)
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
  });

  it('parses invariant with let-in', () => {
    const input = `
      context Person
        inv: let threshold : Integer = 18 in self.age >= threshold
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
  });

  it('parses invariant with if-then-else', () => {
    const input = `
      context Person
        inv: if self.age >= 18 then self.canVote = true else self.canVote = false endif
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
  });

  it('parses invariant with nested collection ops', () => {
    const input = `
      context Company
        inv: self.employees->select(e | e.age > 50)->size() > 0
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ERROR RECOVERY
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Error Recovery', () => {
  it('recovers from bad expression and continues to next constraint', () => {
    const input = `
      context Person
        inv: self.age >
        inv validName: self.name.size() > 0
    `;
    const result = parser.parse(input);
    // Should have at least one error but still parse the second invariant
    expect(result.document.declarations).toHaveLength(1);
    const ctx = result.document.declarations[0];
    if (ctx.type === 'context') {
      // At least one constraint should be parsed
      expect(ctx.constraints.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('recovers from missing colon after inv', () => {
    const input = `
      context Person
        inv self.age > 0
    `;
    const result = parser.parse(input);
    // Should report an error
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles completely malformed input gracefully', () => {
    const input = `this is not OCL at all`;
    const result = parser.parse(input);
    // Should not throw, just report errors
    expect(result.document).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('recovers from bad context and parses next one', () => {
    const input = `
      context
      context Company
        inv: true
    `;
    const result = parser.parse(input);
    // Should have errors but still parse Company context
    const contexts = result.document.declarations.filter(d => d.type === 'context');
    expect(contexts.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FULL DOCUMENT (INTEGRATION)
// ═══════════════════════════════════════════════════════════════════════

describe('OCLDocumentParser — Full Document', () => {
  it('parses a realistic complete OCL document', () => {
    const input = `
      package hr

      context Person
        inv positiveAge: self.age > 0
        inv nameNotEmpty: self.name.size() > 0
        def: isAdult : Boolean = self.age >= 18

      context Person::setAge(newAge: Integer) : Integer
        pre validAge: newAge > 0
        post ageUpdated: self.age = newAge

      context Person::salary : Real
        init: 0.0
        derive: self.baseSalary * (1 + self.bonus)

      context Company
        inv: self.employees->size() > 0
        inv: self.employees->forAll(e | e.age >= 18)
        def: averageAge() : Real = self.employees->collect(e | e.age)->sum() / self.employees->size()

      endpackage
    `;
    const result = parser.parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.document.declarations).toHaveLength(1); // 1 package

    const pkg = result.document.declarations[0];
    if (pkg.type === 'package') {
      expect(pkg.name).toBe('hr');
      expect(pkg.contexts).toHaveLength(4);

      // Person classifier context
      const person = pkg.contexts[0];
      expect(person.kind).toBe('classifier');
      expect(person.constraints).toHaveLength(3);

      // Person::setAge operation context
      const setAge = pkg.contexts[1];
      expect(setAge.kind).toBe('operation');
      expect(setAge.operationName).toBe('setAge');
      expect(setAge.constraints).toHaveLength(2);

      // Person::salary property context
      const salary = pkg.contexts[2];
      expect(salary.kind).toBe('property');
      expect(salary.propertyName).toBe('salary');
      expect(salary.constraints).toHaveLength(2);

      // Company classifier context
      const company = pkg.contexts[3];
      expect(company.kind).toBe('classifier');
      expect(company.constraints).toHaveLength(3);
    }
  });
});
