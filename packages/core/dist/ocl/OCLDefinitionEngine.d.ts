/**
 * OCLDefinitionEngine — Go-to-definition para expresiones OCL.
 *
 * Dado un cursor offset, identifica el símbolo bajo el cursor y
 * devuelve la ubicación de su definición en el metamodelo.
 */
import { MetamodelInfo } from './OCLTypeInference.js';
export type DefinitionTargetKind = 'class' | 'attribute' | 'reference' | 'operation' | 'variable';
export interface OCLDefinitionTarget {
    /** Kind of the target symbol */
    kind: DefinitionTargetKind;
    /** Name of the target */
    name: string;
    /** Owning class (for features) */
    ownerClass?: string;
    /** Type of the target */
    type?: string;
    /** Whether it's multi-valued */
    many?: boolean;
    /** Whether it's a containment reference */
    containment?: boolean;
}
export interface OCLDefinitionResult {
    /** The word that was resolved */
    word: string;
    /** Range of the word in the expression */
    range: {
        start: number;
        end: number;
    };
    /** The resolved definition target */
    target: OCLDefinitionTarget;
}
export declare class OCLDefinitionEngine {
    private readonly metamodel;
    private readonly inferenceEngine;
    private readonly classMap;
    constructor(metamodel: MetamodelInfo);
    /**
     * Resolve the definition of the symbol at the given cursor position.
     */
    findDefinition(expression: string, cursorOffset: number, contextClassName: string): OCLDefinitionResult | null;
    /**
     * Try to find a let or iterator variable definition in the expression.
     */
    private findVariableDefinition;
    private findTokenAtOffset;
    private inferType;
    private escapeRegex;
}
//# sourceMappingURL=OCLDefinitionEngine.d.ts.map