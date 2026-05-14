/**
 * @emf-webapp/core — MTL Executor
 *
 * Executes a parsed MTL template AST against an EMF model context (EObject).
 * Resolves expressions via dot-notation navigation on EObject attributes/references,
 * expands for loops, evaluates if/else conditions, handles protected areas,
 * and collects file outputs.
 */
import type { MTLNode } from './MTLTypes.js';
import type { EObject } from '../ecore/interfaces.js';
export interface MTLExecutionResult {
    files: Array<{
        name: string;
        content: string;
    }>;
    error?: string;
}
export declare class MTLExecutor {
    private fileManager;
    constructor();
    /**
     * Execute parsed MTL templates against a model object.
     * Finds the @main template and generates file outputs.
     */
    execute(templates: MTLNode[], model: EObject): MTLExecutionResult;
    /**
     * Find the template marked as @main in the AST.
     */
    private findMainTemplate;
    /**
     * Execute an array of MTL nodes in the given context.
     * Returns the concatenated text output.
     */
    private executeNodes;
    /**
     * Execute a single MTL node and return its text output.
     */
    private executeNode;
    /**
     * Resolve a dot-notation expression against the context.
     *
     * Supports:
     *   - 'self' → current context object
     *   - 'paramName.attribute.subAttribute' → navigation chains
     *   - String literals like 'hello'
     *   - Number literals like 42
     *   - Boolean literals: true, false
     *
     * For EObject instances, uses the EMF reflexive API (eGet) when possible.
     */
    private resolveExpression;
    /**
     * Resolve a property/attribute name on an object.
     * For EObject, uses the EMF reflexive API (eGet).
     * For plain objects, uses direct property access.
     */
    private resolveOnObject;
    /**
     * Check if an object implements the EObject interface duck-typingly.
     */
    private isEObject;
    /**
     * Determine truthiness for if-condition evaluation.
     */
    private isTruthy;
}
//# sourceMappingURL=MTLExecutor.d.ts.map