/**
 * OCLBatchValidator — Validates all constraints against all model instances.
 *
 * Iterates each constraint, finds matching instances by eClass name,
 * evaluates the expression, and collects pass/fail/error results.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface BatchValidationOptions {
  /** Stop after N errors per constraint */
  maxErrorsPerConstraint?: number;
  /** Timeout per constraint evaluation in ms */
  timeoutMs?: number;
}

export interface BatchConstraintResult {
  constraintName: string;
  context: string;
  kind: string;
  totalInstances: number;
  passedInstances: number;
  failedInstances: number;
  errorInstances: number;
  failures: BatchFailure[];
}

export interface BatchFailure {
  instanceId: string;
  instanceLabel?: string;
  error?: string;
}

export interface BatchValidationReport {
  metamodelName: string;
  timestamp: string;
  totalConstraints: number;
  totalInstances: number;
  passedConstraints: number;
  failedConstraints: number;
  errorConstraints: number;
  results: BatchConstraintResult[];
  durationMs: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getInstanceId(instance: any): string {
  return instance._id ?? instance.id ?? '(unknown)';
}

function getInstanceLabel(instance: any): string | undefined {
  if (instance.name) return String(instance.name);
  if (instance.attributes?.name) return String(instance.attributes.name);
  return undefined;
}

function getEClassName(instance: any): string {
  if (typeof instance.eClass === 'string') return instance.eClass;
  if (instance.eClass && typeof instance.eClass.name === 'string') return instance.eClass.name;
  return '';
}

function matchesContext(instance: any, context: string): boolean {
  const className = getEClassName(instance);
  // Support qualified names: match if the class name equals the context
  // or if the context ends with ::ClassName
  if (className === context) return true;
  if (context.includes('::')) {
    const parts = context.split('::');
    return parts[parts.length - 1] === className;
  }
  return false;
}

// ── Batch Validation ─────────────────────────────────────────────────────

export function validateBatch(
  constraints: Array<{ name: string; context: string; kind: string; expression: string }>,
  metamodel: any,
  modelInstances: any[],
  evaluator: { evaluate: (expr: string, context: any, self: any) => any },
  options?: BatchValidationOptions
): BatchValidationReport {
  const startTime = Date.now();
  const maxErrorsPerConstraint = options?.maxErrorsPerConstraint ?? Infinity;
  const timeoutMs = options?.timeoutMs ?? Infinity;

  const metamodelName: string =
    metamodel?.name ?? metamodel?.metamodelName ?? metamodel?.uri ?? 'Unknown';

  const results: BatchConstraintResult[] = [];
  let totalPassedConstraints = 0;
  let totalFailedConstraints = 0;
  let totalErrorConstraints = 0;
  let totalInstancesEvaluated = 0;

  for (const constraint of constraints) {
    const matchingInstances = modelInstances.filter((inst) =>
      matchesContext(inst, constraint.context)
    );

    const result: BatchConstraintResult = {
      constraintName: constraint.name,
      context: constraint.context,
      kind: constraint.kind,
      totalInstances: matchingInstances.length,
      passedInstances: 0,
      failedInstances: 0,
      errorInstances: 0,
      failures: [],
    };

    let hasError = false;
    const constraintStartTime = Date.now();

    for (const instance of matchingInstances) {
      // Check timeout
      if (timeoutMs !== Infinity && Date.now() - constraintStartTime > timeoutMs) {
        result.failures.push({
          instanceId: getInstanceId(instance),
          instanceLabel: getInstanceLabel(instance),
          error: 'Timeout exceeded',
        });
        result.errorInstances++;
        hasError = true;
        break;
      }

      // Check max errors limit
      if (result.failures.length >= maxErrorsPerConstraint) {
        break;
      }

      try {
        const evalResult = evaluator.evaluate(constraint.expression, instance, instance);

        if (evalResult === true) {
          result.passedInstances++;
        } else if (evalResult === false) {
          result.failedInstances++;
          result.failures.push({
            instanceId: getInstanceId(instance),
            instanceLabel: getInstanceLabel(instance),
          });
        } else {
          // Non-boolean result for an invariant — treat as error
          result.errorInstances++;
          hasError = true;
          result.failures.push({
            instanceId: getInstanceId(instance),
            instanceLabel: getInstanceLabel(instance),
            error: `Non-boolean result: ${String(evalResult)}`,
          });
        }
      } catch (err: any) {
        result.errorInstances++;
        hasError = true;
        result.failures.push({
          instanceId: getInstanceId(instance),
          instanceLabel: getInstanceLabel(instance),
          error: err?.message ?? String(err),
        });
      }
    }

    totalInstancesEvaluated += matchingInstances.length;

    if (hasError || result.errorInstances > 0) {
      totalErrorConstraints++;
    } else if (result.failedInstances > 0) {
      totalFailedConstraints++;
    } else {
      totalPassedConstraints++;
    }

    results.push(result);
  }

  const durationMs = Date.now() - startTime;

  return {
    metamodelName,
    timestamp: new Date().toISOString(),
    totalConstraints: constraints.length,
    totalInstances: totalInstancesEvaluated,
    passedConstraints: totalPassedConstraints,
    failedConstraints: totalFailedConstraints,
    errorConstraints: totalErrorConstraints,
    results,
    durationMs,
  };
}

// ── Report Formatting ────────────────────────────────────────────────────

/** Export report as formatted text */
export function formatBatchReport(report: BatchValidationReport): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  OCL Batch Validation Report');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  Metamodel:    ${report.metamodelName}`);
  lines.push(`  Timestamp:    ${report.timestamp}`);
  lines.push(`  Duration:     ${report.durationMs}ms`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  Summary');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Total constraints:  ${report.totalConstraints}`);
  lines.push(`  Total instances:    ${report.totalInstances}`);
  lines.push(`  Passed:             ${report.passedConstraints}`);
  lines.push(`  Failed:             ${report.failedConstraints}`);
  lines.push(`  Errors:             ${report.errorConstraints}`);
  lines.push('');

  if (report.results.length > 0) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('  Details');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');

    for (const result of report.results) {
      const status =
        result.errorInstances > 0
          ? 'ERROR'
          : result.failedInstances > 0
            ? 'FAIL'
            : 'PASS';

      const statusIcon =
        status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';

      lines.push(
        `  ${statusIcon} [${status}] ${result.context}::${result.constraintName || result.kind}`
      );
      lines.push(
        `    Instances: ${result.totalInstances} | Pass: ${result.passedInstances} | Fail: ${result.failedInstances} | Error: ${result.errorInstances}`
      );

      if (result.failures.length > 0) {
        const shown = result.failures.slice(0, 10);
        for (const failure of shown) {
          const label = failure.instanceLabel
            ? ` (${failure.instanceLabel})`
            : '';
          const errMsg = failure.error ? ` — ${failure.error}` : '';
          lines.push(`      - ${failure.instanceId}${label}${errMsg}`);
        }
        if (result.failures.length > 10) {
          lines.push(`      ... and ${result.failures.length - 10} more`);
        }
      }

      lines.push('');
    }
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
