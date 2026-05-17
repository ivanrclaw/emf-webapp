/**
 * @emf-webapp/core — MTL Executor (Full Acceleo-compatible)
 *
 * Executes a parsed MTL template AST against an EMF model context (EObject).
 * Supports: for with separator/before/after, if/elseif/else, let, file with
 * dynamic names, protected areas, trace, queries, template guards, overrides.
 */
import type { MTLNode } from './MTLTypes.js';
import type { EObject } from '../ecore/interfaces.js';
export interface MTLExecutionResult {
    output: string;
    files: Array<{
        name: string;
        content: string;
    }>;
    error?: string;
}
export declare class MTLExecutor {
    private fileManager;
    private traceOutput;
    constructor();
    /**
     * Execute parsed MTL templates against a model object.
     */
    execute(nodes: MTLNode[], model: EObject): MTLExecutionResult;
    private resolveQueryCache;
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
    private evaluateExpressionAsString;
    private resolveOnObject;
    private isEObject;
    private isTruthy;
    private splitByOperatorOutsideParens;
    private findOperatorOutsideParens;
    private parseFunctionArgs;
    private splitDotChain;
}
//# sourceMappingURL=MTLExecutor.d.ts.map