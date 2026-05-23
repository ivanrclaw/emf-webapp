/**
 * OCLBatchValidator — Validates all constraints against all model instances.
 *
 * Iterates each constraint, finds matching instances by eClass name,
 * evaluates the expression, and collects pass/fail/error results.
 */
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
export declare function validateBatch(constraints: Array<{
    name: string;
    context: string;
    kind: string;
    expression: string;
}>, metamodel: any, modelInstances: any[], evaluator: {
    evaluate: (expr: string, context: any, self: any) => any;
}, options?: BatchValidationOptions): BatchValidationReport;
/** Export report as formatted text */
export declare function formatBatchReport(report: BatchValidationReport): string;
//# sourceMappingURL=OCLBatchValidator.d.ts.map