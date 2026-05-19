/**
 * @emf-webapp/core — MTL Executor (Full Acceleo-compatible)
 *
 * Executes a parsed MTL template AST against an EMF model context (EObject).
 * Supports: for with separator/before/after, if/elseif/else, let, file with
 * dynamic names, protected areas, trace, queries, template guards, overrides.
 */
import type { MTLNode, MTLExecutionResult } from './MTLTypes.js';
import type { EObject } from '../ecore/interfaces.js';
export declare class MTLExecutor {
    private fileManager;
    private traceOutput;
    /** Memoization cache for query results (cleared per execute() call) */
    private queryMemo;
    /** Module metadata for visibility enforcement */
    private moduleRegistry;
    /** Maps template/query name → owning module name */
    private symbolOwner;
    /** Maps template name → parent (overridden) function for super calls */
    private superMap;
    /** Current executing module name (for visibility checks) */
    private currentModule;
    /** Properties files loaded for getProperty() support */
    private properties;
    /** Execution log entries */
    private executionLog;
    /** Trace entries mapping output regions to source */
    private traceEntries;
    /** Execution start time (for relative timestamps) */
    private execStartTime;
    /** Whether tracing/logging is enabled (opt-in for performance) */
    private loggingEnabled;
    /** Root model object (for allInstances) */
    private rootModel;
    /** Iteration stack for current() support — each entry is { collection, index } */
    private iterationStack;
    constructor();
    /**
     * Load properties files for use with getProperty() in MTL expressions.
     * @param files - Array of { name, content } where content is key=value format
     */
    loadProperties(files: Array<{
        name: string;
        content: string;
    }>): void;
    /**
     * Execute parsed MTL templates against a model object.
     * @param options.enableLogging - If true, collect execution log and trace data
     */
    execute(nodes: MTLNode[], model: EObject, options?: {
        enableLogging?: boolean;
    }): MTLExecutionResult;
    private resolveQueryCache;
    /**
     * Check visibility of a symbol being accessed from the current module.
     * Throws if access is not allowed.
     */
    private checkVisibility;
    /**
     * Summarize a model element argument for logging (avoid huge serialization).
     */
    private summarizeArg;
    /**
     * Apply post-treatment expression to template output.
     * The expression operates on `self` which is the output string.
     */
    private applyPostTreatment;
    /**
     * Resolve getProperty() calls.
     * Signatures:
     *   getProperty('key') — search all loaded properties files
     *   getProperty('filename', 'key') — search specific file
     *   getProperty('key', Sequence{params}) — interpolate {0}, {1}, etc.
     */
    private resolveProperty;
    private findMainTemplate;
    private executeNodes;
    private executeNode;
    private evaluateExpression;
    /**
     * Resolve dot-notation and method call chains.
     * Supports: self.attr, obj.method(), obj->method(args), obj.attr.sub
     * Also handles function/query calls from context (e.g., generateInterface(c))
     */
    private resolveNavigation;
    private executeArrowOp;
    private executeArrowOpWithLambda;
    private resolvePropertyOrMethod;
    private callMethod;
    private flattenEAllContents;
    /**
     * Collect all instances of a given type name from the root model tree.
     * Used by Type.allInstances() OCL operation.
     */
    private collectAllInstances;
    private evaluateExpressionAsString;
    private resolveOnObject;
    private isEObject;
    private isTruthy;
    private splitByOperatorOutsideParens;
    private findOperatorOutsideParens;
    /** Find the last '->' outside parentheses (for chained arrow operations) */
    private findLastArrowOutsideParens;
    /** Find first '|' outside parentheses (for lambda separator) */
    private findPipeOutsideParens;
    private parseFunctionArgs;
    private splitDotChain;
}
//# sourceMappingURL=MTLExecutor.d.ts.map