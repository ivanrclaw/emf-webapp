/**
 * OCL Validator Suite — Part 8: Real-World Invariants
 * Tests: complete invariant expressions as they would appear in a real metamodel.
 * These are the patterns that MUST work consistently between OCL editor and metamodel editor.
 */
import { describe, it } from 'vitest';
import { expectValid } from './fixtures.js';

describe('OCL Validator — Student Invariants', () => {
  it('NameNotEmpty: self.name.size() > 0', () =>
    expectValid('self.name.size() > 0'));
  it('ValidAge: self.age >= 16 and self.age <= 100', () =>
    expectValid('self.age >= 16 and self.age <= 100'));
  it('ValidGPA: self.gpa >= 0.0 and self.gpa <= 4.0', () =>
    expectValid('self.gpa >= 0.0 and self.gpa <= 4.0'));
  it('ValidYear: self.year >= 1 and self.year <= 6', () =>
    expectValid('self.year >= 1 and self.year <= 6'));
  it('PositiveCredits: self.credits >= 0', () =>
    expectValid('self.credits >= 0'));
  it('EnrolledHasCourses: self.enrolled implies self.courses->notEmpty()', () =>
    expectValid('self.enrolled implies self.courses->notEmpty()'));
  it('HasAdvisor: self.enrolled implies not self.advisor.oclIsUndefined()', () =>
    expectValid('self.enrolled implies not self.advisor.oclIsUndefined()'));
  it('UniqueCourseCodes: self.courses->isUnique(c | c.code)', () =>
    expectValid('self.courses->isUnique(c | c.code)'));
  it('MaxCreditsPerYear: self.courses->collect(c | c.credits)->sum() <= 40', () =>
    expectValid('self.courses->collect(c | c.credits)->sum() <= 40'));
  it('FriendsNotSelf: self.friends->forAll(f | f <> self)', () =>
    expectValid('self.friends->forAll(f | f <> self)'));
  it('ValidEmail: self.email.size() > 0 implies self.email.indexOf(\'@\') > 0', () =>
    expectValid("self.email.size() > 0 implies self.email.indexOf('@') > 0"));
  it('GpaImpliesEnrolled: self.gpa > 0 implies self.enrolled', () =>
    expectValid('self.gpa > 0 implies self.enrolled'));
});

describe('OCL Validator — Professor Invariants', () => {
  it('PositiveSalary: self.salary > 0', () =>
    expectValid('self.salary > 0', 'Professor'));
  it('ValidExperience: self.yearsExperience >= 0', () =>
    expectValid('self.yearsExperience >= 0', 'Professor'));
  it('TenuredExperience: self.tenured implies self.yearsExperience >= 5', () =>
    expectValid('self.tenured implies self.yearsExperience >= 5', 'Professor'));
  it('TenuredSalary: self.tenured implies self.salary >= 50000', () =>
    expectValid('self.tenured implies self.salary >= 50000', 'Professor'));
  it('HasDepartment: not self.department.oclIsUndefined()', () =>
    expectValid('not self.department.oclIsUndefined()', 'Professor'));
  it('AdviseeLimit: self.advisees->size() <= 10', () =>
    expectValid('self.advisees->size() <= 10', 'Professor'));
  it('AdviseesEnrolled: self.advisees->forAll(s | s.enrolled)', () =>
    expectValid('self.advisees->forAll(s | s.enrolled)', 'Professor'));
  it('SupervisorNotSelf: not self.supervisor.oclIsUndefined() implies self.supervisor <> self', () =>
    expectValid('not self.supervisor.oclIsUndefined() implies self.supervisor <> self', 'Professor'));
  it('CoursesInDepartment: self.courses->forAll(c | c.department = self.department)', () =>
    expectValid('self.courses->forAll(c | c.department = self.department)', 'Professor'));
  it('NameNotEmpty: self.name.size() > 0', () =>
    expectValid('self.name.size() > 0', 'Professor'));
});

describe('OCL Validator — Course Invariants', () => {
  it('PositiveCredits: self.credits > 0', () =>
    expectValid('self.credits > 0', 'Course'));
  it('ValidMaxStudents: self.maxStudents >= 1', () =>
    expectValid('self.maxStudents >= 1', 'Course'));
  it('StudentLimit: self.students->size() <= self.maxStudents', () =>
    expectValid('self.students->size() <= self.maxStudents', 'Course'));
  it('HasProfessor: not self.professor.oclIsUndefined()', () =>
    expectValid('not self.professor.oclIsUndefined()', 'Course'));
  it('CodeNotEmpty: self.code.size() > 0', () =>
    expectValid('self.code.size() > 0', 'Course'));
  it('NoSelfPrerequisite: not self.prerequisites->includes(self)', () =>
    expectValid('not self.prerequisites->includes(self)', 'Course'));
  it('PrereqsHaveCredits: self.prerequisites->forAll(p | p.credits > 0)', () =>
    expectValid('self.prerequisites->forAll(p | p.credits > 0)', 'Course'));
  it('MandatoryHasStudents: self.mandatory implies self.students->notEmpty()', () =>
    expectValid('self.mandatory implies self.students->notEmpty()', 'Course'));
  it('StudentsEnrolled: self.students->forAll(s | s.enrolled)', () =>
    expectValid('self.students->forAll(s | s.enrolled)', 'Course'));
  it('UniqueStudents: self.students->isUnique(s | s.email)', () =>
    expectValid('self.students->isUnique(s | s.email)', 'Course'));
});

describe('OCL Validator — Department Invariants', () => {
  it('NameNotEmpty: self.name.size() > 0', () =>
    expectValid('self.name.size() > 0', 'Department'));
  it('CodeNotEmpty: self.code.size() > 0', () =>
    expectValid('self.code.size() > 0', 'Department'));
  it('PositiveBudget: self.budget > 0', () =>
    expectValid('self.budget > 0', 'Department'));
  it('HeadIsProfessor: self.professors->includes(self.head)', () =>
    expectValid('self.professors->includes(self.head)', 'Department'));
  it('ActiveHasCourses: self.active implies self.courses->notEmpty()', () =>
    expectValid('self.active implies self.courses->notEmpty()', 'Department'));
  it('AllProfessorsHaveSalary: self.professors->forAll(p | p.salary > 0)', () =>
    expectValid('self.professors->forAll(p | p.salary > 0)', 'Department'));
  it('UniqueCourseNames: self.courses->isUnique(c | c.name)', () =>
    expectValid('self.courses->isUnique(c | c.name)', 'Department'));
  it('BudgetCoversStaff: self.budget >= self.professors->collect(p | p.salary)->sum()', () =>
    expectValid('self.budget >= self.professors->collect(p | p.salary)->sum()', 'Department'));
});

describe('OCL Validator — University Invariants', () => {
  it('NameNotEmpty: self.name.size() > 0', () =>
    expectValid('self.name.size() > 0', 'University'));
  it('PositiveRanking: self.ranking > 0', () =>
    expectValid('self.ranking > 0', 'University'));
  it('PositiveBudget: self.budget > 0', () =>
    expectValid('self.budget > 0', 'University'));
  it('HasDepartments: self.departments->notEmpty()', () =>
    expectValid('self.departments->notEmpty()', 'University'));
  it('AllDepartmentsActive: self.departments->forAll(d | d.active)', () =>
    expectValid('self.departments->forAll(d | d.active)', 'University'));
  it('UniqueDeptNames: self.departments->isUnique(d | d.name)', () =>
    expectValid('self.departments->isUnique(d | d.name)', 'University'));
  it('RectorExists: not self.rector.oclIsUndefined()', () =>
    expectValid('not self.rector.oclIsUndefined()', 'University'));
  it('RectorIsTenured: self.rector.tenured', () =>
    expectValid('self.rector.tenured', 'University'));
  it('BudgetDistribution: self.budget >= self.departments->collect(d | d.budget)->sum()', () =>
    expectValid('self.budget >= self.departments->collect(d | d.budget)->sum()', 'University'));
});

describe('OCL Validator — Grade Invariants', () => {
  it('ValidValue: self.value >= 0.0 and self.value <= 10.0', () =>
    expectValid('self.value >= 0.0 and self.value <= 10.0', 'Grade'));
  it('PassedThreshold: self.passed = (self.value >= 5.0)', () =>
    expectValid('self.passed = (self.value >= 5.0)', 'Grade'));
  it('StudentEnrolled: self.student.enrolled', () =>
    expectValid('self.student.enrolled', 'Grade'));
  it('StudentInCourse: self.course.students->includes(self.student)', () =>
    expectValid('self.course.students->includes(self.student)', 'Grade'));
  it('DateNotEmpty: self.date.size() > 0', () =>
    expectValid('self.date.size() > 0', 'Grade'));
});

describe('OCL Validator — Complex Cross-Context Invariants', () => {
  it('Student courses have professor: self.courses->forAll(c | not c.professor.oclIsUndefined())', () =>
    expectValid('self.courses->forAll(c | not c.professor.oclIsUndefined())'));
  it('Student advisor teaches a course: self.advisor.courses->notEmpty()', () =>
    expectValid('self.advisor.courses->notEmpty()'));
  it('Dept head has experience: self.head.yearsExperience >= 10', () =>
    expectValid('self.head.yearsExperience >= 10', 'Department'));
  it('University total budget check: self.departments->collect(d | d.budget)->sum() <= self.budget', () =>
    expectValid('self.departments->collect(d | d.budget)->sum() <= self.budget', 'University'));
  it('Course prereqs from same dept: self.prerequisites->forAll(p | p.department = self.department)', () =>
    expectValid('self.prerequisites->forAll(p | p.department = self.department)', 'Course'));
  it('Professor advisees in their courses: self.advisees->forAll(s | s.courses->exists(c | self.courses->includes(c)))', () =>
    expectValid('self.advisees->forAll(s | s.courses->exists(c | self.courses->includes(c)))', 'Professor'));
});
