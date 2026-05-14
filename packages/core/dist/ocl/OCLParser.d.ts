/**
 * OCLParser — Construye un AST (Abstract Syntax Tree) a partir de tokens OCL.
 *
 * Gramática simplificada:
 *   expression        → orExpression
 *   orExpression       → xorExpression (("or" | "xor" | "implies") xorExpression)*
 *   xorExpression      → andExpression (("and" | "implies") andExpression)*
 *   andExpression      → notExpression (("and") notExpression)*
 *   notExpression      → "not" notExpression | comparisonExpression
 *   comparisonExpression → additiveExpression (("=" | "<>" | ">" | "<" | ">=" | "<=") additiveExpression)?
 *   additiveExpression → multiplicativeExpression (("+" | "-") multiplicativeExpression)*
 *   multiplicativeExpression → unaryExpression (("*" | "/") unaryExpression)*
 *   unaryExpression   → ("-" | "not")? primary
 *   primary           → literal | self | identifier (call chain)
 *   callChain         → ("." identifier | "->" operation | "(" args ")")*
 *   operation         → identifier ("(" args ")")?
 *   args              → expression ("," expression)*
 */
export type ASTNode = LiteralNode | IdentifierNode | SelfNode | UnaryOpNode | BinaryOpNode | MethodCallNode | CollectionOpNode;
export interface LiteralNode {
    type: 'literal';
    valueType: 'number' | 'string' | 'boolean';
    value: number | string | boolean;
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
}
export declare class OCLParser {
    private tokens;
    private pos;
    parse(input: string): ASTNode;
    tryParse(input: string): ASTNode | null;
    private expression;
    private orExpression;
    private xorExpression;
    private andExpression;
    private notExpression;
    private comparisonExpression;
    private additiveExpression;
    private multiplicativeExpression;
    private unaryExpression;
    private primary;
    private parseCallChain;
    private parseArgs;
    private peek;
    private check;
    private advance;
    private match;
    private previous;
    private expect;
}
//# sourceMappingURL=OCLParser.d.ts.map