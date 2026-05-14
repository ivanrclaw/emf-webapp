/**
 * OCLEvaluator — Recorre un AST OCL y lo evalúa contra un modelo EMF.
 *
 * Soporta:
 * - Navegación por atributos y referencias
 * - Operaciones de colección (forAll, exists, select, etc.)
 * - Operadores aritméticos, comparación, lógicos
 * - String operations
 * - Type operations (oclIsTypeOf, oclIsKindOf, etc.)
 */
import { ASTNode } from './OCLParser.js';
export type EValue = string | number | boolean | null | undefined | OCLEObject | OCLEObject[] | Map<string, EValue>;
export interface OCLEObject {
    eClass: string;
    attributes: Record<string, EValue>;
    references: Record<string, EValue>;
}
export interface OCLEClassInfo {
    name: string;
    abstract?: boolean;
    eStructuralFeatures: OCLStructuralFeature[];
}
export interface OCLStructuralFeature {
    name: string;
    type: string;
    kind: 'attribute' | 'reference';
    many: boolean;
    containment?: boolean;
}
export type OCLResult = {
    success: true;
    value: EValue;
} | {
    success: false;
    error: string;
};
export declare class OCLEvaluator {
    private readonly eclassMap;
    constructor(eclassMap: Map<string, OCLEClassInfo>);
    evaluate(ast: ASTNode, context: OCLEObject): OCLResult;
    private evalNode;
    private evalIdentifier;
    private evalUnary;
    private evalBinary;
    private evalMethodCall;
    private evalCollectionOp;
    private toBoolean;
    private toNumber;
    private isEqual;
    private isEObject;
    private isTypeOf;
    private isKindOf;
}
//# sourceMappingURL=OCLEvaluator.d.ts.map