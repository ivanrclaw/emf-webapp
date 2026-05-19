/**
 * OCLHoverEngine — Información de hover para expresiones OCL.
 *
 * Dado un cursor offset, identifica el token/nodo bajo el cursor
 * y devuelve información de tipo, documentación y firma.
 */
import { MetamodelInfo } from './OCLTypeInference.js';
export interface OCLHoverInfo {
    /** The token/word being hovered */
    word: string;
    /** Offset range of the hovered word */
    range: {
        start: number;
        end: number;
    };
    /** Type information */
    type?: string;
    /** Signature (for operations) */
    signature?: string;
    /** Documentation text (markdown) */
    documentation?: string;
}
export declare class OCLHoverEngine {
    private readonly metamodel;
    private readonly inferenceEngine;
    private readonly classMap;
    constructor(metamodel: MetamodelInfo);
    /**
     * Get hover information at a cursor position.
     */
    hover(expression: string, cursorOffset: number, contextClassName: string): OCLHoverInfo | null;
    private hoverIdentifier;
    private makeOperationHover;
    private getCollectionOpHover;
    private getKeywordHover;
    private findTokenAtOffset;
    private isKeywordToken;
    private inferType;
    private eTypeToOCL;
}
//# sourceMappingURL=OCLHoverEngine.d.ts.map