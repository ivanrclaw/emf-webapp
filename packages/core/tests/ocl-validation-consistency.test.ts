/**
 * Test: OCL validation consistency between metamodel editor and OCL editor.
 *
 * Verifies that expressions like `self.salary > 0` are semantically valid
 * when the attribute exists and has the correct type — regardless of whether
 * there are actual instances to evaluate against.
 *
 * This was the root cause of the inconsistency: the metamodel editor was
 * evaluating OCL against fake objects (empty strings, empty arrays) instead
 * of just checking semantic correctness.
 */
import { describe, it, expect } from 'vitest';
import { OCLSemanticValidator } from '../src/ocl/OCLSemanticValidator.js';
import type { MetamodelInfo } from '../src/ocl/OCLTypeInference.js';

// Simulates the AuditMM metamodel with Employee having salary: EInt
const auditMetamodel: MetamodelInfo = {
  classes: [
    {
      name: 'Department',
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'budget', type: 'EInt', many: false },
      ],
      references: [
        { name: 'employees', targetClass: 'Employee', many: true, containment: true },
        { name: 'manager', targetClass: 'Employee', many: false, containment: false },
      ],
    },
    {
      name: 'Employee',
      attributes: [
        { name: 'name', type: 'EString', many: false },
        { name: 'salary', type: 'EInt', many: false },
        { name: 'age', type: 'EInt', many: false },
      ],
      references: [
        { name: 'department', targetClass: 'Department', many: false, containment: false },
      ],
    },
  ],
  hierarchy: new Map(),
};

describe('OCL Validation Consistency — Metamodel vs OCL Editor', () => {
  const validator = new OCLSemanticValidator(auditMetamodel);

  describe('Expressions that should be semantically VALID', () => {
    it('self.salary > 0 (EmployeeSalaryValid)', () => {
      const result = validator.validate('self.salary > 0', 'Employee');
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('self.age >= 18', () => {
      const result = validator.validate('self.age >= 18', 'Employee');
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('self.name.size() > 0', () => {
      const result = validator.validate('self.name.size() > 0', 'Employee');
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('self.salary > 0 and self.age >= 18', () => {
      const result = validator.validate('self.salary > 0 and self.age >= 18', 'Employee');
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('self.employees->forAll(e | e.salary > 0) from Department context', () => {
      const result = validator.validate(
        'self.employees->forAll(e | e.salary > 0)',
        'Department',
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('self.employees->size() > 0 implies self.budget > 0', () => {
      const result = validator.validate(
        'self.employees->size() > 0 implies self.budget > 0',
        'Department',
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('self.employees->select(e | e.salary > 1000)->notEmpty()', () => {
      const result = validator.validate(
        'self.employees->select(e | e.salary > 1000)->notEmpty()',
        'Department',
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });
  });

  describe('Expressions that should be semantically INVALID', () => {
    it('self.nonExistentAttr > 0 (undefined attribute)', () => {
      const result = validator.validate('self.nonExistentAttr > 0', 'Employee');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    });

    it('self.name > 0 (type mismatch: String > Integer — warns about incompatible types)', () => {
      const result = validator.validate('self.name > 0', 'Employee');
      // Should produce a warning about comparing String to Integer
      const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('incompatible types');
    });

    it('self.name <> 1 (type mismatch: String <> Integer — warns about equality)', () => {
      const result = validator.validate('self.name <> 1', 'Employee');
      const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('incompatible types');
    });

    it('self.salary.size() (Integer has no size())', () => {
      const result = validator.validate('self.salary.size()', 'Employee');
      expect(result.valid).toBe(false);
    });

    it('syntax error: self.salary >', () => {
      const result = validator.validate('self.salary >', 'Employee');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    });
  });
});
