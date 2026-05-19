/**
 * OCLCompletionEngine — Motor de autocompletado OCL profesional.
 *
 * Proporciona sugerencias context-aware basadas en:
 * - Posición del cursor en la expresión
 * - Tipo inferido del objeto antes del punto/flecha
 * - Operaciones de la Standard Library
 * - Features del metamodelo (atributos, referencias, operaciones)
 * - Keywords OCL
 * - Variables en scope (let, iteradores)
 */
import { MetamodelInfo } from './OCLTypeInference.js';
export type CompletionItemKind = 'attribute' | 'reference' | 'operation' | 'keyword' | 'variable' | 'type' | 'snippet' | 'collectionOp';
export interface OCLCompletionItem {
    /** Display label */
    label: string;
    /** Kind for icon/sorting */
    kind: CompletionItemKind;
    /** Detailed description */
    detail: string;
    /** Documentation (markdown) */
    documentation?: string;
    /** Text to insert (may differ from label for snippets) */
    insertText: string;
    /** Sort priority (lower = higher priority) */
    sortOrder: number;
}
export type CompletionTrigger = 'dot' | 'arrow' | 'identifier' | 'empty' | 'doubleColon';
export interface CompletionContext {
    trigger: CompletionTrigger;
    /** Partial text typed after the trigger */
    prefix: string;
    /** The expression text before the cursor */
    expressionBefore: string;
}
export declare class OCLCompletionEngine {
    private readonly metamodel;
    private readonly inferenceEngine;
    private readonly classMap;
    constructor(metamodel: MetamodelInfo);
    /**
     * Get completions at a given cursor position in an OCL expression.
     */
    complete(expression: string, cursorOffset: number, contextClassName: string): OCLCompletionItem[];
    /**
     * Analyze what kind of completion is needed at the cursor position.
     */
    private analyzeContext;
    /**
     * Completions after '.' — features + OclAny operations on the inferred type.
     */
    private completeDot;
    /**
     * Completions after '->' — collection operations.
     */
    private completeArrow;
    /**
     * Completions after '::' — enum literals or package-qualified names.
     */
    private completeDoubleColon;
    /**
     * Completions when typing an identifier — keywords, context features, variables.
     */
    private completeIdentifier;
    /**
     * Completions on empty/start — everything available.
     */
    private completeEmpty;
    private inferTypeOfExpression;
    private makeAttributeItem;
    private makeReferenceItem;
    private makeStdLibItem;
    private getCollectionOperations;
    private getKeywordItems;
    private filterByPrefix;
    private eTypeToDisplay;
    private eTypeToOCL;
}
//# sourceMappingURL=OCLCompletionEngine.d.ts.map