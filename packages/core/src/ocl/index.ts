/**
 * OCL Module — Object Constraint Language engine for EMF
 *
 * Exporta Lexer, Parser, Evaluator y Validator.
 */

export { OCLLexer, TokenType } from './OCLLexer.js';
export type { Token } from './OCLLexer.js';

export { OCLParser } from './OCLParser.js';
export type {
  ASTNode,
  LiteralNode,
  IdentifierNode,
  SelfNode,
  UnaryOpNode,
  BinaryOpNode,
  MethodCallNode,
  CollectionOpNode,
  LetInNode,
  IfNode,
  CollectionLiteralNode,
} from './OCLParser.js';

export { OCLEvaluator } from './OCLEvaluator.js';
export type { EValue, OCLEObject, OCLEClassInfo, OCLStructuralFeature, OCLResult } from './OCLEvaluator.js';

export { OCLValidator } from './OCLValidator.js';
export type { OCLValidationError } from './OCLValidator.js';
