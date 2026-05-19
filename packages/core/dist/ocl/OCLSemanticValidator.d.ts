/**
 * OCLSemanticValidator — Validación semántica completa de expresiones OCL.
 *
 * Combina:
 * 1. Validación sintáctica (lexer + parser)
 * 2. Type checking via OCLTypeInferenceEngine
 * 3. Diagnósticos adicionales (warnings, info)
 *
 * Produce diagnósticos con severidad, posición, y mensajes descriptivos
 * al estilo de Eclipse OCL.
 */
import { OCLType } from './OCLTypes.js';
import { MetamodelInfo } from './OCLTypeInference.js';
export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export interface OCLDiagnostic {
    severity: DiagnosticSeverity;
    message: string;
    /** 0-based character offset in the source */
    offset: number;
    /** Length of the problematic span (0 if unknown) */
    length: number;
    /** Machine-readable code for the diagnostic */
    code: string;
}
export interface SemanticValidationResult {
    /** All diagnostics (errors + warnings + info) */
    diagnostics: OCLDiagnostic[];
    /** Convenience: true if no errors (warnings/info are OK) */
    valid: boolean;
    /** The inferred type of the expression (if parseable) */
    inferredType?: OCLType;
}
export declare class OCLSemanticValidator {
    private readonly parser;
    private readonly inferenceEngine;
    private readonly metamodel;
    constructor(metamodel: MetamodelInfo);
    /**
     * Validate an OCL expression in the context of a given EClass.
     */
    validate(expression: string, contextClassName: string): SemanticValidationResult;
    /**
     * Check if a class (or any of its supertypes) has a given feature.
     */
    private classHasFeature;
    /**
     * Walk the AST to produce additional semantic diagnostics beyond type inference.
     */
    private walkAST;
    private checkBinaryOp;
    private checkIfExpr;
    private checkCollectionOp;
    private checkMethodCall;
    private checkLetIn;
    private checkIdentifier;
    private astContainsIdentifier;
}
//# sourceMappingURL=OCLSemanticValidator.d.ts.map