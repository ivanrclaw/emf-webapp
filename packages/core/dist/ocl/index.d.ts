/**
 * OCL Module — Object Constraint Language engine for EMF
 *
 * Exporta Lexer, Parser, Evaluator, Validator, Type System y Standard Library.
 */
export { OCLLexer, TokenType } from './OCLLexer.js';
export type { Token } from './OCLLexer.js';
export { OCLParser } from './OCLParser.js';
export type { ASTNode, LiteralNode, IdentifierNode, SelfNode, UnaryOpNode, BinaryOpNode, MethodCallNode, CollectionOpNode, LetInNode, IfNode, CollectionLiteralNode, TupleLiteralNode, TupleLiteralPart, AtPreNode, } from './OCLParser.js';
export { OCLEvaluator } from './OCLEvaluator.js';
export type { EValue, OCLEObject, OCLEClassInfo, OCLStructuralFeature, OCLResult } from './OCLEvaluator.js';
export { OCLValidator } from './OCLValidator.js';
export type { OCLValidationError } from './OCLValidator.js';
export { OCL, typeToString, typesEqual } from './OCLTypes.js';
export type { OCLType, OCLTypeKind, PrimitiveType, PrimitiveTypeName, CollectionType, CollectionKind, TupleType, TuplePart, ClassType, EnumType, VoidType, InvalidType, AnyType, } from './OCLTypes.js';
export { conformsTo, commonSupertype } from './OCLConformance.js';
export type { ClassHierarchy } from './OCLConformance.js';
export { getOperationsForType, resolveReturnType, OclAnyOperations, BooleanOperations, IntegerOperations, RealOperations, StringOperations, CollectionOperations, CollectionIteratorOperations, OrderedCollectionOperations, SequenceOperations, OrderedSetOperations, SetOperations, } from './OCLStandardLibrary.js';
export type { OCLOperationSignature, OCLOperationParam } from './OCLStandardLibrary.js';
export { OCLTypeInferenceEngine } from './OCLTypeInference.js';
export type { MetamodelInfo, MetamodelClass, MetamodelFeature, MetamodelReference, MetamodelOperation, TypeInferenceResult, TypeInferenceError, } from './OCLTypeInference.js';
export { OCLDocumentParser } from './OCLDocumentParser.js';
export type { OCLDocumentNode, PackageDeclNode, ContextDeclNode, ContextKind, OperationParam, ConstraintNode, InvariantNode, PreConditionNode, PostConditionNode, DefNode, InitNode, DeriveNode, BodyNode, OCLDocumentError, OCLDocumentParseResult, } from './OCLDocumentParser.js';
export { OCLSemanticValidator } from './OCLSemanticValidator.js';
export type { DiagnosticSeverity, OCLDiagnostic, SemanticValidationResult, } from './OCLSemanticValidator.js';
export { OCLCompletionEngine } from './OCLCompletionEngine.js';
export type { CompletionItemKind, OCLCompletionItem, CompletionTrigger, CompletionContext, } from './OCLCompletionEngine.js';
export { OCLHoverEngine } from './OCLHoverEngine.js';
export type { OCLHoverInfo } from './OCLHoverEngine.js';
export { OCLDefinitionEngine } from './OCLDefinitionEngine.js';
export type { DefinitionTargetKind, OCLDefinitionTarget, OCLDefinitionResult, } from './OCLDefinitionEngine.js';
//# sourceMappingURL=index.d.ts.map