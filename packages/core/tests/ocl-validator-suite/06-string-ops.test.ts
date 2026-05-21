/**
 * OCL Validator Suite — Part 6: String Operations
 * Tests: size, concat, substring, toUpper, toLower, trim, indexOf, etc.
 */
import { describe, it, expect } from 'vitest';
import { validate, expectValid, expectInvalid } from './fixtures.js';

describe('OCL Validator — String Operations', () => {
  it('self.name.size()', () => expectValid('self.name.size()'));
  it('self.name.toUpper()', () => expectValid('self.name.toUpper()'));
  it('self.name.toLower()', () => expectValid('self.name.toLower()'));
  it('self.name.trim()', () => expectValid('self.name.trim()'));
  it("self.name.concat(' Jr.')", () => expectValid("self.name.concat(' Jr.')"));
  it('self.name.substring(1, 3)', () => expectValid('self.name.substring(1, 3)'));
  it("self.name.indexOf('a')", () => expectValid("self.name.indexOf('a')"));
  it('self.name.toInteger()', () => expectValid('self.name.toInteger()'));
  it('self.name.toReal()', () => expectValid('self.name.toReal()'));
  it('self.name.toBoolean()', () => expectValid('self.name.toBoolean()'));
  it("self.name.matches('[A-Z].*')", () => expectValid("self.name.matches('[A-Z].*')"));

  // Chained string ops
  it('self.name.toUpper().size()', () => expectValid('self.name.toUpper().size()'));
  it('self.name.trim().toLower()', () => expectValid('self.name.trim().toLower()'));
  it('self.name.size() > 0', () => expectValid('self.name.size() > 0'));
  it("self.name.concat(' ').concat(self.email)", () => expectValid("self.name.concat(' ').concat(self.email)"));

  // String comparisons
  it("self.name = 'Alice'", () => expectValid("self.name = 'Alice'"));
  it("self.name <> ''", () => expectValid("self.name <> ''"));
  it("self.email.size() > 0", () => expectValid("self.email.size() > 0"));

  // Professor/Course string attrs
  it('Professor: self.name.size() > 0', () => expectValid('self.name.size() > 0', 'Professor'));
  it('Course: self.code.toUpper()', () => expectValid('self.code.toUpper()', 'Course'));
  it('Department: self.code.size() > 0', () => expectValid('self.code.size() > 0', 'Department'));
});

describe('OCL Validator — Invalid String Operations', () => {
  it('self.name.nonExistentOp()', () => {
    expectInvalid('self.name.nonExistentOp()');
  });

  it('self.age.toUpper() (Integer has no toUpper)', () => {
    expectInvalid('self.age.toUpper()');
  });

  it('self.enrolled.size() (Boolean has no size)', () => {
    expectInvalid('self.enrolled.size()');
  });

  it('self.age.size() (Integer has no size)', () => {
    expectInvalid('self.age.size()');
  });

  it('self.gpa.trim() (Double has no trim)', () => {
    expectInvalid('self.gpa.trim()');
  });
});
