/**
 * OCLParser — Construye un AST (Abstract Syntax Tree) a partir de tokens OCL.
 *
 * Gramática extendida:
 *   expression            → letExpression | ifExpression | orExpression
 *   letExpression         → "let" IDENTIFIER (":" type)? "=" expression "in" expression | orExpression
 *   ifExpression          → "if" expression "then" expression "else" expression "endif" | orExpression
 *   orExpression          → xorExpression (("or" | "xor") xorExpression)*
 *   xorExpression         → andExpression (("xor" | "implies") andExpression)*
 *   andExpression         → notExpression ("and" notExpression)*
 *   notExpression         → "not" notExpression | comparisonExpression
 *   comparisonExpression  → additiveExpression (("=" | "<>" | ">" | "<" | ">=" | "<=") additiveExpression)?
 *   additiveExpression    → multiplicativeExpression (("+" | "-") multiplicativeExpression)*
 *   multiplicativeExpression → unaryExpression (("*" | "/" | "div" | "mod") unaryExpression)*
 *   unaryExpression       → ("-" | "not")? primary
 *   primary               → literal | self | "(" expression ")" | collectionLiteral | qualifiedName (call chain)
 *   collectionLiteral     → ("Set" | "Bag" | "Sequence" | "OrderedSet") "{" args "}"
 *   qualifiedName         → IDENTIFIER ("::" IDENTIFIER)*
 *   callChain             → ("." identifier | "->" operation | "(" args ")")*
 *   operation             → identifier (("(" args ")")? | lambdaOp | iterateOp)
 *   lambdaOp              → "(" IDENTIFIER (":" type)? ( "|" expression )? ")"
 *   iterateOp             → "(" IDENTIFIER (":" type)? ";" IDENTIFIER (":" type)? "=" expression "|" expression ")"
 *   args                  → expression ("," expression)*
 */
export type ASTNode = LiteralNode | IdentifierNode | SelfNode | UnaryOpNode | BinaryOpNode | MethodCallNode | CollectionOpNode | LetInNode | IfNode | CollectionLiteralNode;
export interface LiteralNode {
    type: 'literal';
    valueType: 'number' | 'string' | 'boolean' | 'null' | 'invalid';
    value: number | string | boolean | null;
}
export interface IdentifierNode {
    type: 'identifier';
    name: string;
}
export interface SelfNode {
    type: 'self';
}
export interface UnaryOpNode {
    type: 'unary';
    operator: string;
    operand: ASTNode;
}
export interface BinaryOpNode {
    type: 'binary';
    operator: string;
    left: ASTNode;
    right: ASTNode;
}
export interface MethodCallNode {
    type: 'methodcall';
    object: ASTNode;
    method: string;
    args: ASTNode[];
}
export interface CollectionOpNode {
    type: 'collectionop';
    source: ASTNode;
    operation: string;
    iterator?: string;
    body?: ASTNode;
    args?: ASTNode[];
    /** For iterate: name of the accumulator variable */
    iterAcc?: string;
    /** For iterate: initial value expression for accumulator */
    iterInit?: ASTNode;
}
export interface LetInNode {
    type: 'letin';
    varName: string;
    varType?: string;
    initExpr: ASTNode;
    bodyExpr: ASTNode;
}
export interface IfNode {
    type: 'if';
    condition: ASTNode;
    thenExpr: ASTNode;
    elseExpr: ASTNode;
}
export interface CollectionLiteralNode {
    type: 'collectionliteral';
    collectionType: 'Set' | 'Bag' | 'Sequence' | 'OrderedSet';
    elements: ASTNode[];
}
export declare class OCLParser {
    private tokens;
    private pos;
    parse(input: string): ASTNode;
    tryParse(input: string): ASTNode | null;
    private expression;
    private parseLetIn;
    private parseIfThenElse;
    private orExpression;
    private xorExpression;
    private andExpression;
    private notExpression;
    private comparisonExpression;
    private additiveExpression;
    private multiplicativeExpression;
    private unaryExpression;
    private primary;
    private parseQualifiedIdentifier;
    /** Parse a type annotation (e.g., "String", "ecore::EClass") */
    private parseQualifiedType;
    private isCollectionTypeKeyword;
    private getCollectionTypeKeyword;
    /** Parse Set{ expr, ... }, Bag{ expr, ... }, etc. */
    private parseCollectionLiteral;
    private parseCallChain;
    private parseLambdaOperation;
    /**
     * Parse a "body" that starts with a dot-chain on an implicit iterator variable.
     * e.g., in "collect(x.name)", after consuming "x", we see ".name" which becomes
     * the body expression "x.name".
     */
    private parseImplicitBody;
    private parseIterateOperation;
    private parseArgs;
    private peek;
    private check;
    private advance;
    private match;
    private previous;
    private expect;
}
//# sourceMappingURL=OCLParser.d.ts.map