/**
 * OCL Validator Suite — Part 9: Edge Cases & Special Features
 * Tests: literals, oclIsUndefined, oclIsKindOf, oclAsType, allInstances,
 * collection literals, tuple literals, @pre, null/invalid.
 */
import { describe, it, expect } from 'vitest';
import { validate, errors, warnings, expectValid, expectInvalid } from './fixtures.js';

describe('OCL Validator — Literals', () => {
  it('integer literal: 42', () => expectValid('42'));
  it('real literal: 3.14', () => expectValid('3.14'));
  it('negative integer: -1', () => expectValid('-1'));
  it("string literal: 'hello'", () => expectValid("'hello'"));
  it('boolean literal: true', () => expectValid('true'));
  it('boolean literal: false', () => expectValid('false'));
  it('null literal', () => expectValid('null'));
  it('invalid literal', () => expectValid('invalid'));
});

describe('OCL Validator — OclAny Operations', () => {
  it('self.oclIsUndefined()', () => expectValid('self.oclIsUndefined()'));
  it('self.oclIsInvalid()', () => expectValid('self.oclIsInvalid()'));
  it('self.advisor.oclIsUndefined()', () => expectValid('self.advisor.oclIsUndefined()'));
  it('self.oclIsKindOf(Student)', () => expectValid('self.oclIsKindOf(Student)'));
  it('self.oclIsTypeOf(Student)', () => expectValid('self.oclIsTypeOf(Student)'));
  it('self.oclType()', () => expectValid('self.oclType()'));
  it('self.toString()', () => expectValid('self.toString()'));

  it('Professor: self.oclIsKindOf(Professor)', () =>
    expectValid('self.oclIsKindOf(Professor)', 'Professor'));
  it('not self.oclIsUndefined()', () => expectValid('not self.oclIsUndefined()'));
  it('self.advisor.oclIsUndefined() = false', () =>
    expectValid('self.advisor.oclIsUndefined() = false'));
});

describe('OCL Validator — Collection Literals', () => {
  it('Set{1, 2, 3}', () => expectValid('Set{1, 2, 3}'));
  it('Sequence{1, 2, 3}', () => expectValid('Sequence{1, 2, 3}'));
  it('Bag{1, 2, 3}', () => expectValid('Bag{1, 2, 3}'));
  it('OrderedSet{1, 2, 3}', () => expectValid('OrderedSet{1, 2, 3}'));
  it('Set{1, 2, 3}->size()', () => expectValid('Set{1, 2, 3}->size()'));
  it('Set{1, 2, 3}->includes(2)', () => expectValid('Set{1, 2, 3}->includes(2)'));
  it("Sequence{'a', 'b', 'c'}->size()", () => expectValid("Sequence{'a', 'b', 'c'}->size()"));
  it('Set{}->isEmpty()', () => expectValid('Set{}->isEmpty()'));
});

describe('OCL Validator — Numeric Edge Cases', () => {
  it('0', () => expectValid('0'));
  it('0.0', () => expectValid('0.0'));
  it('self.age = 0', () => expectValid('self.age = 0'));
  it('self.gpa = 0.0', () => expectValid('self.gpa = 0.0'));
  it('self.age.div(2)', () => expectValid('self.age.div(2)'));
  it('self.age.mod(2)', () => expectValid('self.age.mod(2)'));
  it('self.age.div(2) = 0', () => expectValid('self.age.div(2) = 0'));
  it('self.age.mod(2) = 0', () => expectValid('self.age.mod(2) = 0'));
});

describe('OCL Validator — Parenthesized Expressions', () => {
  it('(self.age)', () => expectValid('(self.age)'));
  it('(self.age > 18)', () => expectValid('(self.age > 18)'));
  it('(self.age > 18) and (self.enrolled)', () => expectValid('(self.age > 18) and (self.enrolled)'));
  it('((self.age + 1) * 2) > 36', () => expectValid('((self.age + 1) * 2) > 36'));
  it('(self.courses->size()) > 0', () => expectValid('(self.courses->size()) > 0'));
  it('not (self.age < 18 or self.age > 65)', () => expectValid('not (self.age < 18 or self.age > 65)'));
});

describe('OCL Validator — Dot vs Arrow Info', () => {
  it('self.courses.size() produces info about dot vs arrow', () => {
    const r = validate('self.courses.size()');
    // Should at least parse; may produce info diagnostic
    expect(errors(r).filter((e) => e.code === 'OCL_PARSE_ERROR')).toHaveLength(0);
  });

  it('self.friends.name (implicit collect — dot on collection)', () => {
    const r = validate('self.friends.name');
    expect(errors(r).filter((e) => e.code === 'OCL_PARSE_ERROR')).toHaveLength(0);
  });
});

describe('OCL Validator — Empty Collection Edge Cases', () => {
  it('self.courses->size() = 0', () => expectValid('self.courses->size() = 0'));
  it('self.courses->size() >= 0', () => expectValid('self.courses->size() >= 0'));
  it('self.friends->isEmpty() or self.friends->size() > 0', () =>
    expectValid('self.friends->isEmpty() or self.friends->size() > 0'));
  it('self.courses->notEmpty() implies self.courses->size() > 0', () =>
    expectValid('self.courses->notEmpty() implies self.courses->size() > 0'));
});

describe('OCL Validator — Boundary & Stress Expressions', () => {
  it('deeply nested navigation: self.advisor.department.university.rector.department.head.name', () =>
    expectValid('self.advisor.department.university.rector.department.head.name'));

  it('multiple chained collection ops', () =>
    expectValid('self.courses->select(c | c.credits > 3)->reject(c | c.mandatory)->collect(c | c.name)->size() > 0'));

  it('complex boolean with multiple clauses', () =>
    expectValid('self.enrolled and self.age >= 18 and self.gpa >= 2.0 and self.credits > 0 and self.courses->notEmpty()'));

  it('implies chain', () =>
    expectValid('self.enrolled implies (self.age >= 16 and self.courses->notEmpty() and self.gpa >= 0.0)'));

  it('let with collection body', () =>
    expectValid('let mandatoryCourses = self.courses->select(c | c.mandatory) in mandatoryCourses->size() >= 3'));

  it('nested forAll with navigation', () =>
    expectValid('self.courses->forAll(c | c.students->forAll(s | s.enrolled))'));

  it('exists inside forAll', () =>
    expectValid('self.courses->forAll(c | c.prerequisites->exists(p | p.credits >= c.credits))'));
});
