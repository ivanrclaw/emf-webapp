/**
 * OCL Validator Suite — Part 3: Arithmetic, Comparisons & Type Mismatches
 * Tests: numeric ops, ordering, equality, type mismatch warnings.
 */
import { describe, it, expect } from 'vitest';
import { validate, errors, warnings, expectValid, expectWarning } from './fixtures.js';

describe('OCL Validator — Arithmetic Operations', () => {
  it('self.age + 1', () => expectValid('self.age + 1'));
  it('self.age - 1', () => expectValid('self.age - 1'));
  it('self.age * 2', () => expectValid('self.age * 2'));
  it('self.gpa / 4.0', () => expectValid('self.gpa / 4.0'));
  it('self.credits + self.year', () => expectValid('self.credits + self.year'));
  it('self.gpa * 100', () => expectValid('self.gpa * 100'));
  it('(self.age + 1) * 2', () => expectValid('(self.age + 1) * 2'));
  it('self.age.abs()', () => expectValid('self.age.abs()'));
  it('self.gpa.floor()', () => expectValid('self.gpa.floor()'));
  it('self.age.max(18)', () => expectValid('self.age.max(18)'));
  it('self.age.min(65)', () => expectValid('self.age.min(65)'));
  it('- self.age', () => expectValid('- self.age'));

  it('Professor: self.salary + 1000', () => expectValid('self.salary + 1000', 'Professor'));
  it('Professor: self.yearsExperience * self.salary', () => expectValid('self.yearsExperience * self.salary', 'Professor'));
});

describe('OCL Validator — Valid Comparisons', () => {
  // Numeric comparisons
  it('self.age > 18', () => expectValid('self.age > 18'));
  it('self.age >= 18', () => expectValid('self.age >= 18'));
  it('self.age < 65', () => expectValid('self.age < 65'));
  it('self.age <= 100', () => expectValid('self.age <= 100'));
  it('self.gpa > 0.0', () => expectValid('self.gpa > 0.0'));
  it('self.gpa >= 2.0', () => expectValid('self.gpa >= 2.0'));
  it('self.credits > 0', () => expectValid('self.credits > 0'));

  // Equality
  it('self.age = 21', () => expectValid('self.age = 21'));
  it('self.age <> 0', () => expectValid('self.age <> 0'));
  it('self.gpa = 4.0', () => expectValid('self.gpa = 4.0'));
  it('self.enrolled = true', () => expectValid('self.enrolled = true'));
  it('self.enrolled <> false', () => expectValid('self.enrolled <> false'));
  it("self.name = 'Alice'", () => expectValid("self.name = 'Alice'"));
  it("self.name <> ''", () => expectValid("self.name <> ''"));

  // Same-type ordering (String lexicographic — valid in OCL)
  it("self.name > 'A'", () => expectValid("self.name > 'A'"));
  it("self.name >= 'A'", () => expectValid("self.name >= 'A'"));

  // Cross-attribute same type
  it('self.age > self.year', () => expectValid('self.age > self.year'));
  it('self.credits = self.year', () => expectValid('self.credits = self.year'));

  // Professor salary comparisons
  it('Professor: self.salary > 0', () => expectValid('self.salary > 0', 'Professor'));
  it('Professor: self.salary >= 30000', () => expectValid('self.salary >= 30000', 'Professor'));
  it('Professor: self.yearsExperience > 0', () => expectValid('self.yearsExperience > 0', 'Professor'));

  // Course
  it('Course: self.credits > 0', () => expectValid('self.credits > 0', 'Course'));
  it('Course: self.maxStudents >= 1', () => expectValid('self.maxStudents >= 1', 'Course'));
});

describe('OCL Validator — Type Mismatch Warnings', () => {
  // Ordering: incompatible types
  it('self.name > 0 (String > Integer)', () => {
    expectWarning('self.name > 0', 'OCL_COMPARISON_TYPE');
  });

  it('self.name < 42 (String < Integer)', () => {
    expectWarning('self.name < 42', 'OCL_COMPARISON_TYPE');
  });

  it('self.name >= 1.5 (String >= Real)', () => {
    expectWarning('self.name >= 1.5', 'OCL_COMPARISON_TYPE');
  });

  // Equality: incompatible types
  it('self.name <> 1 (String <> Integer)', () => {
    expectWarning('self.name <> 1', 'OCL_EQUALITY_TYPE');
  });

  it('self.name = 42 (String = Integer)', () => {
    expectWarning('self.name = 42', 'OCL_EQUALITY_TYPE');
  });

  it('self.enrolled = 1 (Boolean = Integer)', () => {
    expectWarning('self.enrolled = 1', 'OCL_EQUALITY_TYPE');
  });

  it('self.enrolled <> 0 (Boolean <> Integer)', () => {
    expectWarning('self.enrolled <> 0', 'OCL_EQUALITY_TYPE');
  });

  it("self.age = 'hello' (Integer = String)", () => {
    expectWarning("self.age = 'hello'", 'OCL_EQUALITY_TYPE');
  });

  // Valid cross-numeric (Integer vs Real — no warning)
  it('self.age = 21.0 (Integer = Real — compatible)', () => {
    const r = validate('self.age = 21.0');
    const w = warnings(r).filter((d) => d.code === 'OCL_EQUALITY_TYPE');
    expect(w).toHaveLength(0);
  });

  it('self.gpa > 2 (Real > Integer — compatible)', () => {
    const r = validate('self.gpa > 2');
    const w = warnings(r).filter((d) => d.code === 'OCL_COMPARISON_TYPE');
    expect(w).toHaveLength(0);
  });
});
