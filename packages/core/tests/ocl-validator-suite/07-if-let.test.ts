/**
 * OCL Validator Suite — Part 7: If/Then/Else & Let/In Expressions
 * Tests: conditional expressions, let bindings, nested lets, unused variables.
 */
import { describe, it, expect } from 'vitest';
import { validate, warnings, expectValid, expectWarning } from './fixtures.js';

describe('OCL Validator — If/Then/Else', () => {
  it("if self.enrolled then 'active' else 'inactive' endif", () =>
    expectValid("if self.enrolled then 'active' else 'inactive' endif"));
  it('if self.age >= 18 then self.credits else 0 endif', () =>
    expectValid('if self.age >= 18 then self.credits else 0 endif'));
  it('if self.gpa > 3.5 then true else false endif', () =>
    expectValid('if self.gpa > 3.5 then true else false endif'));
  it("if self.courses->isEmpty() then 'none' else self.courses->size().toString() endif", () =>
    expectValid("if self.courses->isEmpty() then 'none' else self.courses->size().toString() endif"));

  // Nested if
  it("if self.age > 18 then if self.enrolled then 'student' else 'adult' endif else 'minor' endif", () =>
    expectValid("if self.age > 18 then if self.enrolled then 'student' else 'adult' endif else 'minor' endif"));

  // If with navigation
  it("if self.advisor.tenured then 'good' else 'ok' endif", () =>
    expectValid("if self.advisor.tenured then 'good' else 'ok' endif"));

  // Professor context
  it("Professor: if self.tenured then 'tenured' else 'adjunct' endif", () =>
    expectValid("if self.tenured then 'tenured' else 'adjunct' endif", 'Professor'));
  it('Professor: if self.yearsExperience > 10 then self.salary * 1.1 else self.salary endif', () =>
    expectValid('if self.yearsExperience > 10 then self.salary * 1.1 else self.salary endif', 'Professor'));

  // Course context
  it("Course: if self.mandatory then 'required' else 'elective' endif", () =>
    expectValid("if self.mandatory then 'required' else 'elective' endif", 'Course'));
});

describe('OCL Validator — If Condition Type Warnings', () => {
  it("warns: if name then 'yes' else 'no' endif (String condition)", () => {
    expectWarning("if name then 'yes' else 'no' endif", 'OCL_IF_CONDITION_TYPE');
  });

  it("warns: if age then 'yes' else 'no' endif (Integer condition)", () => {
    expectWarning("if age then 'yes' else 'no' endif", 'OCL_IF_CONDITION_TYPE');
  });

  it('no warning: if enrolled then 1 else 0 endif (Boolean condition)', () => {
    const r = validate('if enrolled then 1 else 0 endif');
    const w = warnings(r).filter((d) => d.code === 'OCL_IF_CONDITION_TYPE');
    expect(w).toHaveLength(0);
  });

  it('no warning: if age > 18 then 1 else 0 endif (comparison → Boolean)', () => {
    const r = validate('if age > 18 then 1 else 0 endif');
    const w = warnings(r).filter((d) => d.code === 'OCL_IF_CONDITION_TYPE');
    expect(w).toHaveLength(0);
  });
});

describe('OCL Validator — Let/In Expressions', () => {
  it('let x : Integer = self.age in x > 18', () =>
    expectValid('let x : Integer = self.age in x > 18'));
  it('let g : Real = self.gpa in g >= 2.0', () =>
    expectValid('let g : Real = self.gpa in g >= 2.0'));
  it('let n : String = self.name in n.size() > 0', () =>
    expectValid('let n : String = self.name in n.size() > 0'));
  it('let total = self.courses->size() in total > 0', () =>
    expectValid('let total = self.courses->size() in total > 0'));

  // Let with complex body
  it('let adults = self.friends->select(f | f.age >= 18) in adults->size() > 0', () =>
    expectValid('let adults = self.friends->select(f | f.age >= 18) in adults->size() > 0'));

  // Nested let
  it('let x : Integer = self.age in let y : Integer = x + 1 in y > 18', () =>
    expectValid('let x : Integer = self.age in let y : Integer = x + 1 in y > 18'));

  // Professor context
  it('Professor: let bonus = self.salary * 0.1 in self.salary + bonus > 50000', () =>
    expectValid('let bonus = self.salary * 0.1 in self.salary + bonus > 50000', 'Professor'));
});

describe('OCL Validator — Unused Let Variable Warning', () => {
  it('warns: let x : Integer = 42 in self.age > 0 (x unused)', () => {
    expectWarning('let x : Integer = 42 in self.age > 0', 'OCL_UNUSED_VARIABLE');
  });

  it('no warning: let x : Integer = 42 in x > 0 (x used)', () => {
    const r = validate('let x : Integer = 42 in x > 0');
    const w = warnings(r).filter((d) => d.code === 'OCL_UNUSED_VARIABLE');
    expect(w).toHaveLength(0);
  });
});
