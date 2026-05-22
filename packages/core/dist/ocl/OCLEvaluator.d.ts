/**
 * OCLEvaluator — Recorre un AST OCL y lo evalúa contra un modelo EMF.
 *
 * Soporta:
 * - Navegación por atributos y referencias
 * - Operaciones de colección (forAll, exists, select, collect, reject, closure, etc.)
 * - Operadores aritméticos, comparación, lógicos
 * - String operations
 * - Type operations (oclIsTypeOf, oclIsKindOf con herencia, etc.)
 * - Let / in expressions
 * - If / then / else / endif expressions
 * - Collection literales (Set{}, Bag{}, Sequence{}, OrderedSet{})
 * - iterate
 * - div / mod
 */
import { ASTNode } from './OCLParser.js';
export type EValue = string | number | boolean | null | undefined | OCLEObject | EValue[] | Map<string, EValue>;
export interface OCLEObject {
    eClass: string;
    attributes: Record<string, EValue>;
    references: Record<string, EValue>;
    eContainer?: OCLEObject | null;
    eContents?: () => EValue[];
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
    /** Optional map of class name -> list of superclass names for isKindOf inheritance checks */
    private readonly eclassHierarchy?;
    constructor(eclassMap: Map<string, OCLEClassInfo>, 
    /** Optional map of class name -> list of superclass names for isKindOf inheritance checks */
    eclassHierarchy?: Map<string, string[]> | undefined);
    evaluate(ast: ASTNode, context: OCLEObject): OCLResult;
    private evalNode;
    private evalIdentifier;
    private evalLetIn;
    private evalIf;
    private evalCollectionLiteral;
    private evalUnary;
    private evalBinary;
    private evalMethodCall;
    private evalCollectionOp;
    private evalTupleLiteral;
    private evalAtPre;
    private evalMultiIterator;
    private toBoolean;
    private toBooleanOrNull;
    private compareValues;
    private toNumber;
    private isEqual;
    private isEObject;
    private isTypeOf;
    /**
     * Checks if obj is an instance of className or any of its subclasses.
     * If eclassHierarchy is provided, walks the supertype chain.
     */
    private isKindOf;
}
//# sourceMappingURL=OCLEvaluator.d.ts.map