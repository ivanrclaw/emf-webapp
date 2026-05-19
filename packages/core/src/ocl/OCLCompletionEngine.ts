/**
 * OCLCompletionEngine — Motor de autocompletado OCL profesional.
 *
 * Proporciona sugerencias context-aware basadas en:
 * - Posición del cursor en la expresión
 * - Tipo inferido del objeto antes del punto/flecha
 * - Operaciones de la Standard Library
 * - Features del metamodelo (atributos, referencias, operaciones)
 * - Keywords OCL
 * - Variables en scope (let, iteradores)
 */

import { OCLLexer, Token, TokenType } from './OCLLexer.js';
import { OCLParser, ASTNode } from './OCLParser.js';
import { OCLType, OCL, typeToString } from './OCLTypes.js';
import { getOperationsForType, OCLOperationSignature } from './OCLStandardLibrary.js';
import {
  OCLTypeInferenceEngine,
  MetamodelInfo,
  MetamodelClass,
  MetamodelFeature,
  MetamodelReference,
} from './OCLTypeInference.js';

// ── Completion Item Types ─────────────────────────────────────────

export type CompletionItemKind =
  | 'attribute'
  | 'reference'
  | 'operation'
  | 'keyword'
  | 'variable'
  | 'type'
  | 'snippet'
  | 'collectionOp';

export interface OCLCompletionItem {
  /** Display label */
  label: string;
  /** Kind for icon/sorting */
  kind: CompletionItemKind;
  /** Detailed description */
  detail: string;
  /** Documentation (markdown) */
  documentation?: string;
  /** Text to insert (may differ from label for snippets) */
  insertText: string;
  /** Sort priority (lower = higher priority) */
  sortOrder: number;
}

// ── Trigger Context ───────────────────────────────────────────────

export type CompletionTrigger = 'dot' | 'arrow' | 'identifier' | 'empty' | 'doubleColon';

export interface CompletionContext {
  trigger: CompletionTrigger;
  /** Partial text typed after the trigger */
  prefix: string;
  /** The expression text before the cursor */
  expressionBefore: string;
}

// ── Completion Engine ─────────────────────────────────────────────

export class OCLCompletionEngine {
  private readonly inferenceEngine: OCLTypeInferenceEngine;
  private readonly classMap: Map<string, MetamodelClass>;

  constructor(private readonly metamodel: MetamodelInfo) {
    this.inferenceEngine = new OCLTypeInferenceEngine(metamodel);
    this.classMap = new Map();
    for (const cls of metamodel.classes) {
      this.classMap.set(cls.name, cls);
    }
  }

  /**
   * Get completions at a given cursor position in an OCL expression.
   */
  complete(
    expression: string,
    cursorOffset: number,
    contextClassName: string,
  ): OCLCompletionItem[] {
    const ctx = this.analyzeContext(expression, cursorOffset);

    switch (ctx.trigger) {
      case 'dot':
        return this.completeDot(ctx, contextClassName);
      case 'arrow':
        return this.completeArrow(ctx, contextClassName);
      case 'doubleColon':
        return this.completeDoubleColon(ctx);
      case 'identifier':
        return this.completeIdentifier(ctx, contextClassName);
      case 'empty':
        return this.completeEmpty(contextClassName);
    }
  }

  /**
   * Analyze what kind of completion is needed at the cursor position.
   */
  private analyzeContext(expression: string, cursorOffset: number): CompletionContext {
    const before = expression.substring(0, cursorOffset);
    const trimmed = before.trimEnd();

    // Check if we're right after '->'
    if (trimmed.endsWith('->')) {
      return { trigger: 'arrow', prefix: '', expressionBefore: trimmed.slice(0, -2) };
    }

    // Check if we're typing after '->' with partial text
    const arrowMatch = before.match(/->\s*([a-zA-Z_]\w*)$/);
    if (arrowMatch) {
      const prefix = arrowMatch[1];
      const exprBefore = before.substring(0, before.lastIndexOf('->'));
      return { trigger: 'arrow', prefix, expressionBefore: exprBefore };
    }

    // Check if we're right after '.'
    if (trimmed.endsWith('.')) {
      return { trigger: 'dot', prefix: '', expressionBefore: trimmed.slice(0, -1) };
    }

    // Check if we're typing after '.' with partial text
    const dotMatch = before.match(/\.\s*([a-zA-Z_]\w*)$/);
    if (dotMatch) {
      const prefix = dotMatch[1];
      const exprBefore = before.substring(0, before.lastIndexOf('.'));
      return { trigger: 'dot', prefix, expressionBefore: exprBefore };
    }

    // Check if we're after '::'
    if (trimmed.endsWith('::')) {
      return { trigger: 'doubleColon', prefix: '', expressionBefore: trimmed.slice(0, -2) };
    }

    // Check if we're typing an identifier
    const identMatch = before.match(/([a-zA-Z_]\w*)$/);
    if (identMatch) {
      return { trigger: 'identifier', prefix: identMatch[1], expressionBefore: before.slice(0, -identMatch[1].length) };
    }

    return { trigger: 'empty', prefix: '', expressionBefore: before };
  }

  /**
   * Completions after '.' — features + OclAny operations on the inferred type.
   */
  private completeDot(ctx: CompletionContext, contextClassName: string): OCLCompletionItem[] {
    const items: OCLCompletionItem[] = [];
    const objType = this.inferTypeOfExpression(ctx.expressionBefore, contextClassName);

    if (objType.kind === 'class') {
      // Add class features
      const cls = this.classMap.get(objType.name);
      if (cls) {
        for (const attr of cls.attributes) {
          items.push(this.makeAttributeItem(attr));
        }
        for (const ref of cls.references) {
          items.push(this.makeReferenceItem(ref));
        }
        if (cls.operations) {
          for (const op of cls.operations) {
            items.push({
              label: op.name,
              kind: 'operation',
              detail: `${op.name}(${op.params?.map((p) => `${p.name}: ${p.type}`).join(', ') ?? ''}) : ${op.returnType}`,
              insertText: op.params?.length ? `${op.name}($1)` : `${op.name}()`,
              sortOrder: 30,
            });
          }
        }
      }
    }

    // Add standard library operations for the type
    const stdOps = getOperationsForType(objType);
    for (const op of stdOps) {
      items.push(this.makeStdLibItem(op));
    }

    // Filter by prefix
    return this.filterByPrefix(items, ctx.prefix);
  }

  /**
   * Completions after '->' — collection operations.
   */
  private completeArrow(ctx: CompletionContext, contextClassName: string): OCLCompletionItem[] {
    const items: OCLCompletionItem[] = [];

    // All collection operations
    const collectionOps = this.getCollectionOperations();
    items.push(...collectionOps);

    return this.filterByPrefix(items, ctx.prefix);
  }

  /**
   * Completions after '::' — enum literals or package-qualified names.
   */
  private completeDoubleColon(ctx: CompletionContext): OCLCompletionItem[] {
    // For now, suggest all class names as potential type references
    const items: OCLCompletionItem[] = [];
    for (const name of Array.from(this.classMap.keys())) {
      items.push({
        label: name,
        kind: 'type',
        detail: `Class ${name}`,
        insertText: name,
        sortOrder: 50,
      });
    }
    return items;
  }

  /**
   * Completions when typing an identifier — keywords, context features, variables.
   */
  private completeIdentifier(ctx: CompletionContext, contextClassName: string): OCLCompletionItem[] {
    const items: OCLCompletionItem[] = [];

    // Context class features
    const cls = this.classMap.get(contextClassName);
    if (cls) {
      for (const attr of cls.attributes) {
        items.push(this.makeAttributeItem(attr));
      }
      for (const ref of cls.references) {
        items.push(this.makeReferenceItem(ref));
      }
    }

    // Keywords
    items.push(...this.getKeywordItems());

    // Type names (for oclIsTypeOf, etc.)
    for (const name of Array.from(this.classMap.keys())) {
      items.push({
        label: name,
        kind: 'type',
        detail: `Class ${name}`,
        insertText: name,
        sortOrder: 80,
      });
    }

    return this.filterByPrefix(items, ctx.prefix);
  }

  /**
   * Completions on empty/start — everything available.
   */
  private completeEmpty(contextClassName: string): OCLCompletionItem[] {
    return this.completeIdentifier({ trigger: 'identifier', prefix: '', expressionBefore: '' }, contextClassName);
  }

  // ── Type Inference Helper ───────────────────────────────────────

  private inferTypeOfExpression(expr: string, contextClassName: string): OCLType {
    try {
      const parser = new OCLParser();
      const ast = parser.parse(expr);
      const result = this.inferenceEngine.infer(ast, contextClassName);
      return result.type;
    } catch {
      // If parsing fails, return AnyType
      return OCL.Any;
    }
  }

  // ── Item Builders ───────────────────────────────────────────────

  private makeAttributeItem(attr: MetamodelFeature): OCLCompletionItem {
    const typeStr = this.eTypeToDisplay(attr.type, attr.many);
    return {
      label: attr.name,
      kind: 'attribute',
      detail: `${attr.name} : ${typeStr}`,
      documentation: `Attribute of type ${typeStr}`,
      insertText: attr.name,
      sortOrder: 10,
    };
  }

  private makeReferenceItem(ref: MetamodelReference): OCLCompletionItem {
    const typeStr = ref.many ? `Set(${ref.targetClass})` : ref.targetClass;
    return {
      label: ref.name,
      kind: 'reference',
      detail: `${ref.name} : ${typeStr}${ref.containment ? ' [containment]' : ''}`,
      documentation: `Reference to ${ref.targetClass}${ref.many ? ' (multi-valued)' : ''}`,
      insertText: ref.name,
      sortOrder: 15,
    };
  }

  private makeStdLibItem(op: OCLOperationSignature): OCLCompletionItem {
    const params = op.params?.map((p) => `${p.name}: ${p.type}`).join(', ') ?? '';
    const signature = `${op.name}(${params}) : ${op.returnType}`;
    const hasParams = op.params && op.params.length > 0;
    return {
      label: op.name,
      kind: 'operation',
      detail: signature,
      documentation: op.description,
      insertText: hasParams ? `${op.name}($1)` : `${op.name}()`,
      sortOrder: 40,
    };
  }

  private getCollectionOperations(): OCLCompletionItem[] {
    const ops: Array<{ name: string; detail: string; insert: string; doc: string }> = [
      // Query operations
      { name: 'size', detail: 'size() : Integer', insert: 'size()', doc: 'Number of elements' },
      { name: 'isEmpty', detail: 'isEmpty() : Boolean', insert: 'isEmpty()', doc: 'True if collection has no elements' },
      { name: 'notEmpty', detail: 'notEmpty() : Boolean', insert: 'notEmpty()', doc: 'True if collection has elements' },
      { name: 'includes', detail: 'includes(obj) : Boolean', insert: 'includes($1)', doc: 'True if collection contains obj' },
      { name: 'excludes', detail: 'excludes(obj) : Boolean', insert: 'excludes($1)', doc: 'True if collection does not contain obj' },
      { name: 'includesAll', detail: 'includesAll(c) : Boolean', insert: 'includesAll($1)', doc: 'True if all elements of c are in this' },
      { name: 'excludesAll', detail: 'excludesAll(c) : Boolean', insert: 'excludesAll($1)', doc: 'True if no elements of c are in this' },
      { name: 'count', detail: 'count(obj) : Integer', insert: 'count($1)', doc: 'Number of occurrences of obj' },
      // Element access
      { name: 'first', detail: 'first() : T', insert: 'first()', doc: 'First element (ordered collections)' },
      { name: 'last', detail: 'last() : T', insert: 'last()', doc: 'Last element (ordered collections)' },
      { name: 'at', detail: 'at(i) : T', insert: 'at($1)', doc: 'Element at 1-based index' },
      { name: 'indexOf', detail: 'indexOf(obj) : Integer', insert: 'indexOf($1)', doc: '1-based index of first occurrence' },
      // Aggregation
      { name: 'sum', detail: 'sum() : Real', insert: 'sum()', doc: 'Sum of numeric elements' },
      { name: 'min', detail: 'min() : T', insert: 'min()', doc: 'Minimum element' },
      { name: 'max', detail: 'max() : T', insert: 'max()', doc: 'Maximum element' },
      // Transformation
      { name: 'flatten', detail: 'flatten() : Collection(T)', insert: 'flatten()', doc: 'Flatten nested collections' },
      { name: 'asSet', detail: 'asSet() : Set(T)', insert: 'asSet()', doc: 'Convert to Set (remove duplicates)' },
      { name: 'asBag', detail: 'asBag() : Bag(T)', insert: 'asBag()', doc: 'Convert to Bag' },
      { name: 'asSequence', detail: 'asSequence() : Sequence(T)', insert: 'asSequence()', doc: 'Convert to Sequence' },
      { name: 'asOrderedSet', detail: 'asOrderedSet() : OrderedSet(T)', insert: 'asOrderedSet()', doc: 'Convert to OrderedSet' },
      { name: 'reverse', detail: 'reverse() : OrderedCollection(T)', insert: 'reverse()', doc: 'Reverse order' },
      // Set operations
      { name: 'union', detail: 'union(c) : Collection(T)', insert: 'union($1)', doc: 'Union with another collection' },
      { name: 'intersection', detail: 'intersection(c) : Set(T)', insert: 'intersection($1)', doc: 'Common elements' },
      { name: 'symmetricDifference', detail: 'symmetricDifference(c) : Set(T)', insert: 'symmetricDifference($1)', doc: 'Elements in one but not both' },
      { name: 'including', detail: 'including(obj) : Collection(T)', insert: 'including($1)', doc: 'Add element' },
      { name: 'excluding', detail: 'excluding(obj) : Collection(T)', insert: 'excluding($1)', doc: 'Remove all occurrences' },
      // Ordered operations
      { name: 'append', detail: 'append(obj) : Sequence(T)', insert: 'append($1)', doc: 'Add to end' },
      { name: 'prepend', detail: 'prepend(obj) : Sequence(T)', insert: 'prepend($1)', doc: 'Add to beginning' },
      { name: 'insertAt', detail: 'insertAt(i, obj) : Sequence(T)', insert: 'insertAt($1, $2)', doc: 'Insert at 1-based position' },
      { name: 'subSequence', detail: 'subSequence(lower, upper) : Sequence(T)', insert: 'subSequence($1, $2)', doc: 'Extract range (1-based inclusive)' },
      { name: 'subOrderedSet', detail: 'subOrderedSet(lower, upper) : OrderedSet(T)', insert: 'subOrderedSet($1, $2)', doc: 'Extract range (1-based inclusive)' },
      // Iterator operations
      { name: 'forAll', detail: 'forAll(v | expr) : Boolean', insert: 'forAll(${1:e} | ${2:true})', doc: 'True if expr holds for all elements' },
      { name: 'exists', detail: 'exists(v | expr) : Boolean', insert: 'exists(${1:e} | ${2:true})', doc: 'True if expr holds for at least one element' },
      { name: 'select', detail: 'select(v | expr) : Collection(T)', insert: 'select(${1:e} | ${2:true})', doc: 'Elements where expr is true' },
      { name: 'reject', detail: 'reject(v | expr) : Collection(T)', insert: 'reject(${1:e} | ${2:true})', doc: 'Elements where expr is false' },
      { name: 'collect', detail: 'collect(v | expr) : Collection(S)', insert: 'collect(${1:e} | ${2:e})', doc: 'Map each element to expr result' },
      { name: 'collectNested', detail: 'collectNested(v | expr) : Collection(S)', insert: 'collectNested(${1:e} | ${2:e})', doc: 'Like collect but preserves nesting' },
      { name: 'closure', detail: 'closure(v | expr) : Set(T)', insert: 'closure(${1:e} | ${2:e})', doc: 'Transitive closure' },
      { name: 'one', detail: 'one(v | expr) : Boolean', insert: 'one(${1:e} | ${2:true})', doc: 'Exactly one element satisfies expr' },
      { name: 'any', detail: 'any(v | expr) : T', insert: 'any(${1:e} | ${2:true})', doc: 'First element satisfying expr' },
      { name: 'isUnique', detail: 'isUnique(v | expr) : Boolean', insert: 'isUnique(${1:e} | ${2:e})', doc: 'All expr results are distinct' },
      { name: 'sortedBy', detail: 'sortedBy(v | expr) : OrderedSet(T)', insert: 'sortedBy(${1:e} | ${2:e})', doc: 'Sort by expr value' },
      { name: 'iterate', detail: 'iterate(v; acc = init | expr) : S', insert: 'iterate(${1:e}; ${2:acc} : ${3:Integer} = ${4:0} | ${5:acc})', doc: 'General iteration with accumulator' },
    ];

    return ops.map((op, i) => ({
      label: op.name,
      kind: 'collectionOp' as CompletionItemKind,
      detail: op.detail,
      documentation: op.doc,
      insertText: op.insert,
      sortOrder: 20 + i * 0.1,
    }));
  }

  private getKeywordItems(): OCLCompletionItem[] {
    const keywords = [
      { name: 'self', detail: 'Current context object', insert: 'self' },
      { name: 'if', detail: 'if condition then expr else expr endif', insert: 'if ${1:true} then ${2:expr} else ${3:expr} endif' },
      { name: 'let', detail: 'let var = expr in body', insert: 'let ${1:x} = ${2:expr} in ${3:body}' },
      { name: 'true', detail: 'Boolean literal', insert: 'true' },
      { name: 'false', detail: 'Boolean literal', insert: 'false' },
      { name: 'null', detail: 'Null value', insert: 'null' },
      { name: 'invalid', detail: 'OclInvalid value', insert: 'invalid' },
      { name: 'not', detail: 'Boolean negation', insert: 'not ' },
      { name: 'and', detail: 'Boolean conjunction', insert: 'and ' },
      { name: 'or', detail: 'Boolean disjunction', insert: 'or ' },
      { name: 'xor', detail: 'Boolean exclusive or', insert: 'xor ' },
      { name: 'implies', detail: 'Boolean implication', insert: 'implies ' },
      { name: 'Set', detail: 'Set{elements}', insert: 'Set{$1}' },
      { name: 'Bag', detail: 'Bag{elements}', insert: 'Bag{$1}' },
      { name: 'Sequence', detail: 'Sequence{elements}', insert: 'Sequence{$1}' },
      { name: 'OrderedSet', detail: 'OrderedSet{elements}', insert: 'OrderedSet{$1}' },
      { name: 'Tuple', detail: 'Tuple{name = value, ...}', insert: 'Tuple{${1:name} = ${2:value}}' },
    ];

    return keywords.map((kw, i) => ({
      label: kw.name,
      kind: 'keyword' as CompletionItemKind,
      detail: kw.detail,
      insertText: kw.insert,
      sortOrder: 60 + i,
    }));
  }

  // ── Utilities ───────────────────────────────────────────────────

  private filterByPrefix(items: OCLCompletionItem[], prefix: string): OCLCompletionItem[] {
    if (!prefix) return items;
    const lower = prefix.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().startsWith(lower));
  }

  private eTypeToDisplay(eType: string, many?: boolean): string {
    const base = this.eTypeToOCL(eType);
    return many ? `Set(${base})` : base;
  }

  private eTypeToOCL(eType: string): string {
    switch (eType) {
      case 'EString': return 'String';
      case 'EInt': case 'EIntegerObject': return 'Integer';
      case 'EDouble': case 'EFloat': case 'EDoubleObject': return 'Real';
      case 'EBoolean': case 'EBooleanObject': return 'Boolean';
      default: return eType;
    }
  }
}
