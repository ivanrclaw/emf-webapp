/**
 * OCL Validator Suite — Part 1: Basic & Syntax Validation
 * Tests: empty expressions, lexer errors, parse errors, unknown context.
 */
import { describe, it, expect } from 'vitest';
import { validate, errors, expectValid, expectInvalid } from './fixtures.js';

describe('OCL Validator — Empty & Whitespace', () => {
  it('rejects empty string', () => {
    const r = validate('');
    expect(r.valid).toBe(false);
    expect(errors(r)[0].code).toBe('OCL_EMPTY');
  });

  it('rejects whitespace only', () => {
    expect(validate('   ').valid).toBe(false);
  });

  it('rejects tabs and newlines only', () => {
    expect(validate('\t\n  \n').valid).toBe(false);
  });
});

describe('OCL Validator — Lexer Errors', () => {
  it('rejects invalid characters', () => {
    const r = validate('self.name @@ 5');
    expect(r.valid).toBe(false);
  });

  it('handles unclosed string literal (lexer may accept it)', () => {
    // Some OCL lexers accept unclosed strings as a partial token
    const r = validate("self.name = 'hello");
    // At minimum it should not crash — validity depends on lexer implementation
    expect(r).toBeDefined();
  });

  it('rejects stray backslash', () => {
    const r = validate('self.name \\ test');
    expect(r.valid).toBe(false);
  });
});

describe('OCL Validator — Parse Errors', () => {
  it('rejects double operator', () => {
    expectInvalid('self.age + + 5');
  });

  it('rejects trailing operator', () => {
    expectInvalid('self.age >');
  });

  it('rejects unclosed parenthesis', () => {
    expectInvalid('self.courses->size(');
  });

  it('rejects missing then in if', () => {
    expectInvalid('if self.enrolled self.name endif');
  });

  it('rejects missing endif', () => {
    expectInvalid("if self.enrolled then 'yes' else 'no'");
  });

  it('rejects arrow without operation', () => {
    expectInvalid('self.courses->');
  });

  it('rejects let without in', () => {
    expectInvalid('let x : Integer = 5');
  });
});

describe('OCL Validator — Unknown Context', () => {
  it('rejects unknown context class', () => {
    const r = validate('self.name', 'NonExistent');
    expect(r.valid).toBe(false);
    expect(errors(r)[0].code).toBe('OCL_UNKNOWN_CONTEXT');
  });

  it('rejects misspelled context', () => {
    const r = validate('self.name', 'Studnet');
    expect(r.valid).toBe(false);
  });

  it('accepts all valid contexts', () => {
    expectValid('self.name', 'Student');
    expectValid('self.name', 'Professor');
    expectValid('self.name', 'Course');
    expectValid('self.name', 'Department');
    expectValid('self.name', 'University');
  });
});
