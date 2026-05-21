/**
 * OCL Validator Suite — Part 4: Boolean Logic & Logical Operators
 * Tests: and, or, not, xor, implies, boolean type checking.
 */
import { describe, it, expect } from 'vitest';
import { validate, warnings, expectValid, expectWarning } from './fixtures.js';

describe('OCL Validator — Boolean Expressions', () => {
  it('self.enrolled', () => expectValid('self.enrolled'));
  it('not self.enrolled', () => expectValid('not self.enrolled'));
  it('self.enrolled and self.age > 18', () => expectValid('self.enrolled and self.age > 18'));
  it('self.enrolled or self.gpa > 3.0', () => expectValid('self.enrolled or self.gpa > 3.0'));
  it('self.enrolled xor self.gpa < 1.0', () => expectValid('self.enrolled xor self.gpa < 1.0'));
  it('self.enrolled implies self.credits > 0', () => expectValid('self.enrolled implies self.credits > 0'));
  it('not (self.age < 18)', () => expectValid('not (self.age < 18)'));
  it('(self.age > 18) and (self.gpa >= 2.0)', () => expectValid('(self.age > 18) and (self.gpa >= 2.0)'));
  it('self.age > 18 and self.age < 65', () => expectValid('self.age > 18 and self.age < 65'));
  it('self.enrolled implies self.age >= 16', () => expectValid('self.enrolled implies self.age >= 16'));

  it('Professor: self.tenured implies self.yearsExperience >= 5', () =>
    expectValid('self.tenured implies self.yearsExperience >= 5', 'Professor'));
  it('Professor: self.tenured and self.salary > 50000', () =>
    expectValid('self.tenured and self.salary > 50000', 'Professor'));
  it('Professor: not self.tenured or self.yearsExperience > 0', () =>
    expectValid('not self.tenured or self.yearsExperience > 0', 'Professor'));

  it('Course: self.mandatory implies self.credits >= 3', () =>
    expectValid('self.mandatory implies self.credits >= 3', 'Course'));
  it('Department: self.active and self.budget > 0', () =>
    expectValid('self.active and self.budget > 0', 'Department'));
});

describe('OCL Validator — Boolean Type Warnings', () => {
  it('warns: name and age (non-boolean operands)', () => {
    expectWarning('name and age', 'OCL_BOOLEAN_EXPECTED');
  });

  it('warns: name or age', () => {
    expectWarning('name or age', 'OCL_BOOLEAN_EXPECTED');
  });

  it('warns: name implies age', () => {
    expectWarning('name implies age', 'OCL_BOOLEAN_EXPECTED');
  });

  it('warns: name xor age', () => {
    expectWarning('name xor age', 'OCL_BOOLEAN_EXPECTED');
  });

  it('no warning: enrolled and (age > 18)', () => {
    const r = validate('enrolled and (age > 18)');
    const w = warnings(r).filter((d) => d.code === 'OCL_BOOLEAN_EXPECTED');
    expect(w).toHaveLength(0);
  });

  it('no warning: (gpa > 2.0) implies enrolled', () => {
    const r = validate('(gpa > 2.0) implies enrolled');
    const w = warnings(r).filter((d) => d.code === 'OCL_BOOLEAN_EXPECTED');
    expect(w).toHaveLength(0);
  });
});
