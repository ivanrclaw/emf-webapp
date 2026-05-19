/**
 * OCLDocumentParser — Parser para documentos OCL completos (Complete OCL)
 *
 * Soporta la gramática completa de documentos OCL 2.4:
 * - package/endpackage declarations
 * - context (classifier, operation, property)
 * - inv, pre, post, def, init, derive, body
 * - Tuple literals y tipos
 * - @pre en postcondiciones
 * - Multi-iterator (forAll(i, j | body))
 */
import { ASTNode } from './OCLParser.js';
export interface OCLDocumentNode {
    type: 'document';
    declarations: (PackageDeclNode | ContextDeclNode)[];
}
export interface PackageDeclNode {
    type: 'package';
    name: string;
    contexts: ContextDeclNode[];
}
export type ContextKind = 'classifier' | 'operation' | 'property';
export interface ContextDeclNode {
    type: 'context';
    kind: ContextKind;
    className: string;
    /** For operation context: operation name */
    operationName?: string;
    /** For operation context: parameters */
    operationParams?: OperationParam[];
    /** For operation/property context: return/property type */
    returnType?: string;
    /** For property context: property name */
    propertyName?: string;
    constraints: ConstraintNode[];
}
export interface OperationParam {
    name: string;
    type: string;
}
export type ConstraintNode = InvariantNode | PreConditionNode | PostConditionNode | DefNode | InitNode | DeriveNode | BodyNode;
export interface InvariantNode {
    type: 'invariant';
    name?: string;
    expression: ASTNode;
}
export interface PreConditionNode {
    type: 'precondition';
    name?: string;
    expression: ASTNode;
}
export interface PostConditionNode {
    type: 'postcondition';
    name?: string;
    expression: ASTNode;
}
export interface DefNode {
    type: 'def';
    name: string;
    /** If it's an operation def, has params */
    params?: OperationParam[];
    returnType?: string;
    expression: ASTNode;
}
export interface InitNode {
    type: 'init';
    expression: ASTNode;
}
export interface DeriveNode {
    type: 'derive';
    expression: ASTNode;
}
export interface BodyNode {
    type: 'body';
    name?: string;
    expression: ASTNode;
}
export interface OCLDocumentError {
    message: string;
    position: number;
    recoverable: boolean;
}
export interface OCLDocumentParseResult {
    document: OCLDocumentNode;
    errors: OCLDocumentError[];
}
export declare class OCLDocumentParser {
    private tokens;
    private pos;
    private errors;
    private readonly exprParser;
    /**
     * Parse a complete OCL document string.
     */
    parse(input: string): OCLDocumentParseResult;
    private parsePackage;
    private parseContext;
    private parseClassifierContext;
    private parseOperationContext;
    private parsePropertyContext;
    private parseConstraints;
    private parseInvariant;
    private parsePrecondition;
    private parsePostcondition;
    private parseDef;
    private parseInit;
    private parseDerive;
    private parseBody;
    private parseExpression;
    private parseQualifiedName;
    private parseOptionalName;
    private parseParam;
    private parseTypeName;
    private expectIdentifierOrKeyword;
    private isIdentifierLike;
    private tokensToString;
    private peek;
    private advance;
    private check;
    private expect;
    private isAtEnd;
    private currentPosition;
    private addError;
    private recoverToNextDeclaration;
}
//# sourceMappingURL=OCLDocumentParser.d.ts.map