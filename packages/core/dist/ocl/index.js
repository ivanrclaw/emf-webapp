/**
 * OCL Module — Object Constraint Language engine for EMF
 *
 * Exporta Lexer, Parser, Evaluator, Validator, Type System y Standard Library.
 */
export { OCLLexer, TokenType } from './OCLLexer.js';
export { OCLParser } from './OCLParser.js';
export { OCLEvaluator } from './OCLEvaluator.js';
export { OCLValidator } from './OCLValidator.js';
// ── Type System (Phase 1) ───────────────────────────────────────────
export { OCL, typeToString, typesEqual } from './OCLTypes.js';
export { conformsTo, commonSupertype } from './OCLConformance.js';
export { getOperationsForType, resolveReturnType, OclAnyOperations, BooleanOperations, IntegerOperations, RealOperations, StringOperations, CollectionOperations, CollectionIteratorOperations, OrderedCollectionOperations, SequenceOperations, OrderedSetOperations, SetOperations, } from './OCLStandardLibrary.js';
export { OCLTypeInferenceEngine } from './OCLTypeInference.js';
export { OCLDocumentParser } from './OCLDocumentParser.js';
// ── Semantic Validator (Phase 4) ─────────────────────────────────────
export { OCLSemanticValidator } from './OCLSemanticValidator.js';
// ── IDE Features (Phase 5) ───────────────────────────────────────────
export { OCLCompletionEngine } from './OCLCompletionEngine.js';
export { OCLHoverEngine } from './OCLHoverEngine.js';
export { OCLDefinitionEngine } from './OCLDefinitionEngine.js';
// ── File I/O (Phase 7) ──────────────────────────────────────────────────
export { importOCLFile, exportOCLFile } from './OCLFileIO.js';
// ── Batch Validation (Phase 7) ──────────────────────────────────────────
export { validateBatch, formatBatchReport } from './OCLBatchValidator.js';
//# sourceMappingURL=index.js.map