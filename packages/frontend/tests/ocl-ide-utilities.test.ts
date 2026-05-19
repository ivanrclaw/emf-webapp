import { describe, it, expect } from 'vitest';
import {
  classifyDiagnostics,
  isFormEqual,
  offsetToLineColumn,
  runStatusFromResult,
} from '../src/components/ocl/types';

describe('OCL IDE — types/utilities', () => {
  describe('offsetToLineColumn', () => {
    it('returns 1,1 at offset 0', () => {
      expect(offsetToLineColumn('hello', 0)).toEqual({ line: 1, column: 1 });
    });

    it('counts column on a single line', () => {
      expect(offsetToLineColumn('hello world', 6)).toEqual({ line: 1, column: 7 });
    });

    it('jumps to next line on newline', () => {
      const txt = 'self.name\n  and\n  ok';
      expect(offsetToLineColumn(txt, 10)).toEqual({ line: 2, column: 1 });
      expect(offsetToLineColumn(txt, 12)).toEqual({ line: 2, column: 3 });
      expect(offsetToLineColumn(txt, 16)).toEqual({ line: 3, column: 1 });
    });

    it('clamps offset past end of text', () => {
      const r = offsetToLineColumn('abc', 1000);
      expect(r.line).toBe(1);
      expect(r.column).toBeGreaterThan(1);
    });
  });

  describe('isFormEqual', () => {
    const form = {
      name: 'inv1',
      context: 'Employee',
      expression: 'self.name <> null',
      severity: 'error',
    };

    it('returns false against null', () => {
      expect(isFormEqual(form, null)).toBe(false);
    });

    it('returns true when all fields match', () => {
      expect(isFormEqual(form, { ...form })).toBe(true);
    });

    it('returns false when expression differs', () => {
      expect(isFormEqual(form, { ...form, expression: 'true' })).toBe(false);
    });

    it('returns false when severity differs', () => {
      expect(isFormEqual(form, { ...form, severity: 'warning' })).toBe(false);
    });
  });

  describe('classifyDiagnostics', () => {
    it('returns zeros for empty/undefined', () => {
      expect(classifyDiagnostics(undefined)).toEqual({ errors: 0, warnings: 0, infos: 0 });
      expect(classifyDiagnostics([])).toEqual({ errors: 0, warnings: 0, infos: 0 });
    });

    it('counts each severity', () => {
      const res = classifyDiagnostics([
        { offset: 0, length: 1, message: 'e1', severity: 'error' },
        { offset: 5, length: 1, message: 'e2', severity: 'error' },
        { offset: 10, length: 1, message: 'w1', severity: 'warning' },
        { offset: 15, length: 1, message: 'i1', severity: 'info' },
      ]);
      expect(res).toEqual({ errors: 2, warnings: 1, infos: 1 });
    });
  });

  describe('runStatusFromResult', () => {
    const base = {
      constraintId: 'c1',
      name: 'n',
      context: 'Employee',
      expression: 'true',
    };

    it('marks errored runs', () => {
      expect(
        runStatusFromResult({ ...base, passed: false, error: 'parse failure' }),
      ).toEqual({ status: 'error', message: 'parse failure' });
    });

    it('marks passed runs', () => {
      expect(runStatusFromResult({ ...base, passed: true })).toEqual({ status: 'passed' });
    });

    it('marks failed runs without error', () => {
      expect(runStatusFromResult({ ...base, passed: false })).toEqual({ status: 'failed' });
    });
  });
});
