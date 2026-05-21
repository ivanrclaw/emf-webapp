/**
 * OCL Validator Suite — Part 2: Attribute Access & Navigation
 * Tests: self access, direct attributes, chained navigation, undefined features.
 */
import { describe, it, expect } from 'vitest';
import { validate, errors, expectValid, expectInvalid } from './fixtures.js';

describe('OCL Validator — Self & Direct Attributes', () => {
  it('self.name (String)', () => expectValid('self.name'));
  it('self.age (Integer)', () => expectValid('self.age'));
  it('self.email (String)', () => expectValid('self.email'));
  it('self.gpa (Double)', () => expectValid('self.gpa'));
  it('self.year (Integer)', () => expectValid('self.year'));
  it('self.enrolled (Boolean)', () => expectValid('self.enrolled'));
  it('self.credits (Integer)', () => expectValid('self.credits'));

  it('bare attribute: name', () => expectValid('name'));
  it('bare attribute: age', () => expectValid('age'));
  it('bare attribute: gpa', () => expectValid('gpa'));

  it('Professor: self.salary', () => expectValid('self.salary', 'Professor'));
  it('Professor: self.tenured', () => expectValid('self.tenured', 'Professor'));
  it('Professor: self.yearsExperience', () => expectValid('self.yearsExperience', 'Professor'));

  it('Course: self.credits', () => expectValid('self.credits', 'Course'));
  it('Course: self.maxStudents', () => expectValid('self.maxStudents', 'Course'));
  it('Course: self.mandatory', () => expectValid('self.mandatory', 'Course'));

  it('Department: self.code', () => expectValid('self.code', 'Department'));
  it('Department: self.budget', () => expectValid('self.budget', 'Department'));
  it('Department: self.active', () => expectValid('self.active', 'Department'));

  it('University: self.ranking', () => expectValid('self.ranking', 'University'));
  it('University: self.isPublic', () => expectValid('self.isPublic', 'University'));
  it('University: self.budget', () => expectValid('self.budget', 'University'));
});

describe('OCL Validator — Reference Navigation', () => {
  it('single-valued ref: self.advisor', () => expectValid('self.advisor'));
  it('multi-valued ref: self.courses', () => expectValid('self.courses'));
  it('self-ref: self.friends', () => expectValid('self.friends'));

  it('Professor: self.department', () => expectValid('self.department', 'Professor'));
  it('Professor: self.courses', () => expectValid('self.courses', 'Professor'));
  it('Professor: self.advisees', () => expectValid('self.advisees', 'Professor'));
  it('Professor: self.supervisor (self-ref)', () => expectValid('self.supervisor', 'Professor'));

  it('Course: self.students', () => expectValid('self.students', 'Course'));
  it('Course: self.professor', () => expectValid('self.professor', 'Course'));
  it('Course: self.prerequisites (self-ref)', () => expectValid('self.prerequisites', 'Course'));
  it('Course: self.department', () => expectValid('self.department', 'Course'));

  it('Department: self.courses', () => expectValid('self.courses', 'Department'));
  it('Department: self.head', () => expectValid('self.head', 'Department'));
  it('Department: self.professors', () => expectValid('self.professors', 'Department'));
  it('Department: self.university', () => expectValid('self.university', 'Department'));

  it('University: self.departments', () => expectValid('self.departments', 'University'));
  it('University: self.rector', () => expectValid('self.rector', 'University'));
});

describe('OCL Validator — Chained Navigation', () => {
  it('self.advisor.name', () => expectValid('self.advisor.name'));
  it('self.advisor.salary', () => expectValid('self.advisor.salary'));
  it('self.advisor.department', () => expectValid('self.advisor.department'));
  it('self.advisor.department.name', () => expectValid('self.advisor.department.name'));
  it('self.advisor.department.university', () => expectValid('self.advisor.department.university'));
  it('self.advisor.department.university.ranking', () => expectValid('self.advisor.department.university.ranking'));

  it('Course: self.professor.name', () => expectValid('self.professor.name', 'Course'));
  it('Course: self.department.head.salary', () => expectValid('self.department.head.salary', 'Course'));
  it('Course: self.department.university.rector.name', () => expectValid('self.department.university.rector.name', 'Course'));

  it('Department: self.head.supervisor.name', () => expectValid('self.head.supervisor.name', 'Department'));
  it('University: self.rector.department.code', () => expectValid('self.rector.department.code', 'University'));
});

describe('OCL Validator — Undefined Features', () => {
  it('self.nonExistent', () => {
    const r = expectInvalid('self.nonExistent');
    expect(errors(r).some((e) => e.code === 'OCL_UNDEFINED_FEATURE')).toBe(true);
  });

  it('self.advisor.nonExistent', () => {
    expectInvalid('self.advisor.nonExistent');
  });

  it('self.salary (Student has no salary)', () => {
    expectInvalid('self.salary', 'Student');
  });

  it('self.gpa (Professor has no gpa)', () => {
    expectInvalid('self.gpa', 'Professor');
  });

  it('self.students (Student has no students ref)', () => {
    expectInvalid('self.students', 'Student');
  });

  it('self.rector (Department has no rector)', () => {
    expectInvalid('self.rector', 'Department');
  });

  it('deep chain with invalid segment: self.advisor.department.gpa', () => {
    expectInvalid('self.advisor.department.gpa');
  });
});
