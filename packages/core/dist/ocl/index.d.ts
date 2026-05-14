/**
 * OCL Module — Object Constraint Language engine for EMF
 *
 * Exporta Lexer, Parser, Evaluator y Validator.
 */
export { OCLLexer, TokenType } from './OCLLexer';
export type { Token } from './OCLLexer';
export { OCLParser } from './OCLParser';
export type { ASTNode, LiteralNode, IdentifierNode, SelfNode, UnaryOpNode, BinaryOpNode, MethodCallNode, CollectionOpNode, } from './OCLParser';
export { OCLEvaluator } from './OCLEvaluator';
export type { EValue, OCLEObject, OCLEClassInfo, OCLStructuralFeature, OCLResult } from './OCLEvaluator';
export { OCLValidator } from './OCLValidator';
export type { OCLValidationError } from './OCLValidator';
//# sourceMappingURL=index.d.ts.map