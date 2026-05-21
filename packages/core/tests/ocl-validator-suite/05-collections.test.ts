/**
 * OCL Validator Suite — Part 5: Collection Operations
 * Tests: size, isEmpty, notEmpty, includes, forAll, exists, select, reject,
 * collect, any, one, isUnique, sortedBy, closure, iterate.
 */
import { describe, it, expect } from 'vitest';
import { validate, errors, expectValid, expectInvalid } from './fixtures.js';

describe('OCL Validator — Basic Collection Ops', () => {
  it('self.courses->size()', () => expectValid('self.courses->size()'));
  it('self.courses->isEmpty()', () => expectValid('self.courses->isEmpty()'));
  it('self.courses->notEmpty()', () => expectValid('self.courses->notEmpty()'));
  it('self.friends->size()', () => expectValid('self.friends->size()'));
  it('self.friends->isEmpty()', () => expectValid('self.friends->isEmpty()'));

  it('Professor: self.advisees->size()', () => expectValid('self.advisees->size()', 'Professor'));
  it('Professor: self.courses->notEmpty()', () => expectValid('self.courses->notEmpty()', 'Professor'));
  it('Department: self.professors->size()', () => expectValid('self.professors->size()', 'Department'));
  it('University: self.departments->size()', () => expectValid('self.departments->size()', 'University'));
  it('Course: self.students->size()', () => expectValid('self.students->size()', 'Course'));
  it('Course: self.prerequisites->isEmpty()', () => expectValid('self.prerequisites->isEmpty()', 'Course'));
});

describe('OCL Validator — Iterator Operations (forAll, exists, select, reject, collect)', () => {
  // forAll
  it('self.courses->forAll(c | c.credits > 0)', () =>
    expectValid('self.courses->forAll(c | c.credits > 0)'));
  it('self.friends->forAll(f | f.age >= 18)', () =>
    expectValid('self.friends->forAll(f | f.age >= 18)'));
  it('Professor: self.advisees->forAll(s | s.enrolled)', () =>
    expectValid('self.advisees->forAll(s | s.enrolled)', 'Professor'));
  it('Department: self.professors->forAll(p | p.salary > 0)', () =>
    expectValid('self.professors->forAll(p | p.salary > 0)', 'Department'));
  it('University: self.departments->forAll(d | d.active)', () =>
    expectValid('self.departments->forAll(d | d.active)', 'University'));

  // exists
  it('self.courses->exists(c | c.mandatory)', () =>
    expectValid('self.courses->exists(c | c.mandatory)'));
  it('self.friends->exists(f | f.gpa > 3.5)', () =>
    expectValid('self.friends->exists(f | f.gpa > 3.5)'));
  it('Professor: self.advisees->exists(s | s.gpa >= 3.0)', () =>
    expectValid('self.advisees->exists(s | s.gpa >= 3.0)', 'Professor'));

  // select
  it('self.courses->select(c | c.credits >= 3)', () =>
    expectValid('self.courses->select(c | c.credits >= 3)'));
  it('self.friends->select(f | f.enrolled)', () =>
    expectValid('self.friends->select(f | f.enrolled)'));
  it('Department: self.professors->select(p | p.tenured)', () =>
    expectValid('self.professors->select(p | p.tenured)', 'Department'));

  // reject
  it('self.courses->reject(c | c.mandatory)', () =>
    expectValid('self.courses->reject(c | c.mandatory)'));
  it('self.friends->reject(f | f.age < 18)', () =>
    expectValid('self.friends->reject(f | f.age < 18)'));

  // collect
  it('self.courses->collect(c | c.name)', () =>
    expectValid('self.courses->collect(c | c.name)'));
  it('self.courses->collect(c | c.credits)', () =>
    expectValid('self.courses->collect(c | c.credits)'));
  it('self.friends->collect(f | f.name)', () =>
    expectValid('self.friends->collect(f | f.name)'));
  it('Professor: self.advisees->collect(s | s.gpa)', () =>
    expectValid('self.advisees->collect(s | s.gpa)', 'Professor'));
});

describe('OCL Validator — Advanced Collection Ops', () => {
  // any
  it('self.courses->any(c | c.mandatory)', () =>
    expectValid('self.courses->any(c | c.mandatory)'));

  // one
  it('self.courses->one(c | c.credits > 6)', () =>
    expectValid('self.courses->one(c | c.credits > 6)'));

  // isUnique
  it('self.courses->isUnique(c | c.code)', () =>
    expectValid('self.courses->isUnique(c | c.code)'));

  // sortedBy
  it('self.courses->sortedBy(c | c.credits)', () =>
    expectValid('self.courses->sortedBy(c | c.credits)'));
  it('self.friends->sortedBy(f | f.name)', () =>
    expectValid('self.friends->sortedBy(f | f.name)'));

  // closure (self-referencing)
  it('Course: self.prerequisites->closure(c | c.prerequisites)', () =>
    expectValid('self.prerequisites->closure(c | c.prerequisites)', 'Course'));
  it('Professor: self.supervisor->closure(p | p.supervisor) — not collection source', () => {
    // supervisor is single-valued, so -> on it may produce an error or info
    const r = validate('self.supervisor->closure(p | p.supervisor)', 'Professor');
    // At minimum it should parse
    expect(errors(r).filter((e) => e.code === 'OCL_PARSE_ERROR')).toHaveLength(0);
  });

  // iterate
  it('self.courses->iterate(c; acc : Integer = 0 | acc + c.credits)', () => {
    const r = validate('self.courses->iterate(c; acc : Integer = 0 | acc + c.credits)');
    expect(errors(r).filter((e) => e.code === 'OCL_PARSE_ERROR')).toHaveLength(0);
  });
});

describe('OCL Validator — Chained Collection Ops', () => {
  it('self.courses->select(c | c.credits > 3)->size()', () =>
    expectValid('self.courses->select(c | c.credits > 3)->size()'));
  it('self.courses->select(c | c.mandatory)->notEmpty()', () =>
    expectValid('self.courses->select(c | c.mandatory)->notEmpty()'));
  it('self.courses->collect(c | c.credits)->sum()', () =>
    expectValid('self.courses->collect(c | c.credits)->sum()'));
  it('self.friends->select(f | f.enrolled)->collect(f | f.name)', () =>
    expectValid('self.friends->select(f | f.enrolled)->collect(f | f.name)'));
  it('self.friends->reject(f | f.age < 18)->size() > 0', () =>
    expectValid('self.friends->reject(f | f.age < 18)->size() > 0'));
  it('Department: self.professors->select(p | p.tenured)->collect(p | p.salary)->sum()', () =>
    expectValid('self.professors->select(p | p.tenured)->collect(p | p.salary)->sum()', 'Department'));
  it('University: self.departments->collect(d | d.professors)->size()', () =>
    expectValid('self.departments->collect(d | d.professors)->size()', 'University'));
});

describe('OCL Validator — Collection on Non-Collection (Error)', () => {
  it('self.age->size() (Integer is not a collection)', () => {
    const r = validate('self.age->size()');
    expect(r.valid).toBe(false);
    expect(errors(r).some((e) => e.code === 'OCL_NOT_COLLECTION')).toBe(true);
  });

  it('self.enrolled->isEmpty() (Boolean is not a collection)', () => {
    const r = validate('self.enrolled->isEmpty()');
    expect(r.valid).toBe(false);
  });

  it('self.gpa->forAll(x | x > 0) (Double is not a collection)', () => {
    const r = validate('self.gpa->forAll(x | x > 0)');
    expect(r.valid).toBe(false);
  });
});
