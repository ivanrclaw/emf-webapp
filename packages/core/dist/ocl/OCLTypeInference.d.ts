/**
 * OCLTypeInference — Motor de inferencia de tipos OCL 2.4
 *
 * Dado un AST + contexto (EClass) + metamodelo → infiere el tipo de cada nodo.
 * Resuelve cadenas de navegación, implicit collect, y operaciones de colección.
 */
import { ASTNode } from './OCLParser.js';
import { OCLType } from './OCLTypes.js';
import { ClassHierarchy } from './OCLConformance.js';
export interface MetamodelInfo {
    /** All EClasses with their features */
    classes: MetamodelClass[];
    /** Class hierarchy: className → direct supertype names */
    hierarchy?: ClassHierarchy;
}
export interface MetamodelClass {
    name: string;
    abstract?: boolean;
    attributes: MetamodelFeature[];
    references: MetamodelReference[];
    operations?: MetamodelOperation[];
}
export interface MetamodelFeature {
    name: string;
    type: string;
    many?: boolean;
}
export interface MetamodelReference {
    name: string;
    targetClass: string;
    many?: boolean;
    containment?: boolean;
}
export interface MetamodelOperation {
    name: string;
    returnType: string;
    params?: Array<{
        name: string;
        type: string;
    }>;
}
export interface TypeInferenceResult {
    type: OCLType;
    errors: TypeInferenceError[];
}
export interface TypeInferenceError {
    message: string;
    node: ASTNode;
}
export declare class OCLTypeInferenceEngine {
    private readonly metamodel;
    private readonly classMap;
    private readonly hierarchy;
    constructor(metamodel: MetamodelInfo);
    /**
     * Infer the type of an AST node given a context EClass name.
     */
    infer(node: ASTNode, contextClassName: string): TypeInferenceResult;
    private inferNode;
    private inferLiteral;
    private inferIdentifier;
    private inferUnary;
    private inferBinary;
    private inferMethodCall;
    private inferCollectionOp;
    private inferLetIn;
    private inferIf;
    private inferCollectionLiteral;
    /**
     * Resolve the type of a feature (attribute or reference) on a class.
     */
    private resolveFeatureType;
    /**
     * Same as resolveFeatureType but without error reporting (for supertype traversal).
     */
    private resolveFeatureTypeSilent;
    private ecoreTypeToOCLType;
    private resolveOperationReturnType;
}
//# sourceMappingURL=OCLTypeInference.d.ts.map