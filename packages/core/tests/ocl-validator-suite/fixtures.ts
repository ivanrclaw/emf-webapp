/**
 * Shared test metamodel and utilities for OCL Semantic Validator tests.
 * Rich metamodel with inheritance, enums, operations, and multiple contexts.
 */
import { OCLSemanticValidator, OCLDiagnostic, SemanticValidationResult } from '../../src/ocl/OCLSemanticValidator.js';
import type { MetamodelInfo } from '../../src/ocl/OCLTypeInference.js';

// ── Rich Metamodel (University domain) ───────────────────────────────
// Covers: inheritance, multi-level navigation, operations, abstract classes,
// self-references, multiple refs between same classes, numeric types.

export const universityMetamodel: MetamodelInfo = {
  classes: [
    {
      name: 'NamedElement',
      abstract: true,
      attributes: [
        { name: 'name', type: 'EString', many: false },
      ],
      references: [],
    },
    {
      name: 'University',
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'ranking', type: 'EInt', many: false },
        { name: 'isPublic', type: 'EBoolean', many: false },
        { name: 'budget', type: 'EDouble', many: false },
      ],
      references: [
        { name: 'departments', targetClass: 'Department', many: true, containment: true },
        { name: 'rector', targetClass: 'Professor', many: false, containment: false },
      ],
      operations: [
        { name: 'totalStudents', returnType: 'EInt', params: [] },
      ],
    },
    {
      name: 'Department',
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'code', type: 'EString', many: false },
        { name: 'budget', type: 'EDouble', many: false },
        { name: 'active', type: 'EBoolean', many: false },
      ],
      references: [
        { name: 'courses', targetClass: 'Course', many: true, containment: true },
        { name: 'head', targetClass: 'Professor', many: false, containment: false },
        { name: 'professors', targetClass: 'Professor', many: true, containment: false },
        { name: 'university', targetClass: 'University', many: false, containment: false },
      ],
    },
    {
      name: 'Person',
      abstract: true,
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'age', type: 'EInt', many: false },
        { name: 'email', type: 'EString', many: false },
      ],
      references: [],
    },
    {
      name: 'Student',
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'age', type: 'EInt', many: false },
        { name: 'email', type: 'EString', many: false },
        { name: 'gpa', type: 'EDouble', many: false },
        { name: 'year', type: 'EInt', many: false },
        { name: 'enrolled', type: 'EBoolean', many: false },
        { name: 'credits', type: 'EInt', many: false },
      ],
      references: [
        { name: 'courses', targetClass: 'Course', many: true, containment: false },
        { name: 'advisor', targetClass: 'Professor', many: false, containment: false },
        { name: 'friends', targetClass: 'Student', many: true, containment: false },
      ],
    },
    {
      name: 'Professor',
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'age', type: 'EInt', many: false },
        { name: 'email', type: 'EString', many: false },
        { name: 'salary', type: 'EDouble', many: false },
        { name: 'tenured', type: 'EBoolean', many: false },
        { name: 'yearsExperience', type: 'EInt', many: false },
      ],
      references: [
        { name: 'department', targetClass: 'Department', many: false, containment: false },
        { name: 'courses', targetClass: 'Course', many: true, containment: false },
        { name: 'advisees', targetClass: 'Student', many: true, containment: false },
        { name: 'supervisor', targetClass: 'Professor', many: false, containment: false },
      ],
    },
    {
      name: 'Course',
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'code', type: 'EString', many: false },
        { name: 'credits', type: 'EInt', many: false },
        { name: 'maxStudents', type: 'EInt', many: false },
        { name: 'mandatory', type: 'EBoolean', many: false },
      ],
      references: [
        { name: 'students', targetClass: 'Student', many: true, containment: false },
        { name: 'professor', targetClass: 'Professor', many: false, containment: false },
        { name: 'prerequisites', targetClass: 'Course', many: true, containment: false },
        { name: 'department', targetClass: 'Department', many: false, containment: false },
      ],
    },
    {
      name: 'Grade',
      attributes: [
        { name: 'value', type: 'EDouble', many: false },
        { name: 'date', type: 'EString', many: false },
        { name: 'passed', type: 'EBoolean', many: false },
      ],
      references: [
        { name: 'student', targetClass: 'Student', many: false, containment: false },
        { name: 'course', targetClass: 'Course', many: false, containment: false },
      ],
    },
  ],
  hierarchy: new Map([
    ['Student', ['Person']],
    ['Professor', ['Person']],
    ['University', ['NamedElement']],
    ['Department', ['NamedElement']],
    ['Course', ['NamedElement']],
  ]),
};

// ── Helpers ──────────────────────────────────────────────────────────

export function createValidator(metamodel: MetamodelInfo = universityMetamodel) {
  return new OCLSemanticValidator(metamodel);
}

export function validate(
  expr: string,
  ctx = 'Student',
  metamodel: MetamodelInfo = universityMetamodel,
): SemanticValidationResult {
  const validator = createValidator(metamodel);
  return validator.validate(expr, ctx);
}

export function errors(result: SemanticValidationResult): OCLDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === 'error');
}

export function warnings(result: SemanticValidationResult): OCLDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === 'warning');
}

export function infos(result: SemanticValidationResult): OCLDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === 'info');
}

export function expectValid(expr: string, ctx?: string) {
  const result = validate(expr, ctx);
  if (!result.valid) {
    const msgs = result.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => d.message)
      .join('\n');
    throw new Error(`Expected valid but got errors:\n${msgs}\nExpression: ${expr}`);
  }
  return result;
}

export function expectInvalid(expr: string, ctx?: string) {
  const result = validate(expr, ctx);
  if (result.valid) {
    throw new Error(`Expected invalid but expression passed: ${expr}`);
  }
  return result;
}

export function expectWarning(expr: string, code: string, ctx?: string) {
  const result = validate(expr, ctx);
  const w = warnings(result);
  if (!w.some((d) => d.code === code)) {
    const actual = w.map((d) => d.code).join(', ') || '(none)';
    throw new Error(`Expected warning ${code} but got: ${actual}\nExpression: ${expr}`);
  }
  return result;
}
