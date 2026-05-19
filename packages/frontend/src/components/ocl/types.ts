/**
 * Shared types for the OCL IDE components.
 */
import type { OCLConstraint, OCLValidationResult } from '../../api/client';

export type Severity = 'error' | 'warning' | 'info';

export interface OCLDiagnostic {
  offset: number;
  length: number;
  message: string;
  severity: Severity;
  /** Optional: line/column already resolved against the constraint expression. */
  line?: number;
  column?: number;
}

export interface AggregatedProblem extends OCLDiagnostic {
  constraintId: string;
  constraintName: string;
  context: string;
}

export interface ConstraintFormState {
  name: string;
  context: string;
  expression: string;
  severity: string;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export type ConstraintRunStatus = 'unknown' | 'passed' | 'failed' | 'error';

export interface ConstraintRunSummary {
  status: ConstraintRunStatus;
  message?: string;
}

export type RunSummaries = Record<string, ConstraintRunSummary>;

export type DiagnosticsMap = Record<string, OCLDiagnostic[]>;

export interface OCLConstraintWithStatus extends OCLConstraint {
  /** Per-constraint diagnostics summary derived from latest diagnose call. */
  diagSummary?: { errors: number; warnings: number; infos: number };
  /** Latest validation run status for this constraint. */
  run?: ConstraintRunSummary;
  /** True if currently being edited and unsaved. */
  dirty?: boolean;
}

export function classifyDiagnostics(diags: OCLDiagnostic[] | undefined) {
  if (!diags || diags.length === 0) return { errors: 0, warnings: 0, infos: 0 };
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const d of diags) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos };
}

export function runStatusFromResult(r: OCLValidationResult): ConstraintRunSummary {
  if (r.error) return { status: 'error', message: r.error };
  if (r.passed) return { status: 'passed' };
  return { status: 'failed' };
}

/** Convert character offset within `text` to 1-based (line, column). */
export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

/** Compare a constraint form to its persisted constraint to detect dirty state. */
export function isFormEqual(
  a: { name: string; context: string; expression: string; severity: string },
  c: { name: string; context: string; expression: string; severity: string } | null,
): boolean {
  if (!c) return false;
  return (
    a.name === c.name &&
    a.context === c.context &&
    a.expression === c.expression &&
    a.severity === c.severity
  );
}
