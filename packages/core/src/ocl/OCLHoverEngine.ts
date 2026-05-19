/**
 * OCLHoverEngine — Información de hover para expresiones OCL.
 *
 * Dado un cursor offset, identifica el token/nodo bajo el cursor
 * y devuelve información de tipo, documentación y firma.
 */

import { OCLLexer, Token, TokenType } from './OCLLexer.js';
import { OCLParser, ASTNode } from './OCLParser.js';
import { OCLType, OCL, typeToString } from './OCLTypes.js';
import { getOperationsForType, OCLOperationSignature } from './OCLStandardLibrary.js';
import {
  OCLTypeInferenceEngine,
  MetamodelInfo,
  MetamodelClass,
} from './OCLTypeInference.js';

// ── Hover Result ──────────────────────────────────────────────────

export interface OCLHoverInfo {
  /** The token/word being hovered */
  word: string;
  /** Offset range of the hovered word */
  range: { start: number; end: number };
  /** Type information */
  type?: string;
  /** Signature (for operations) */
  signature?: string;
  /** Documentation text (markdown) */
  documentation?: string;
}

// ── Hover Engine ──────────────────────────────────────────────────

export class OCLHoverEngine {
  private readonly inferenceEngine: OCLTypeInferenceEngine;
  private readonly classMap: Map<string, MetamodelClass>;
  private readonly hierarchy: Map<string, string[]>;

  constructor(private readonly metamodel: MetamodelInfo) {
    this.inferenceEngine = new OCLTypeInferenceEngine(metamodel);
    this.classMap = new Map();
    this.hierarchy = metamodel.hierarchy ?? new Map();
    for (const cls of metamodel.classes) {
      this.classMap.set(cls.name, cls);
    }
  }

  /**
   * Find a feature (attribute/reference/operation) by name in a class hierarchy.
   */
  private findFeatureInHierarchy(
    className: string,
    featureName: string,
    seen?: Set<string>,
  ): { kind: 'attribute' | 'reference' | 'operation'; type: string; many?: boolean; owner: string; targetClass?: string; containment?: boolean } | null {
    seen = seen || new Set<string>();
    if (seen.has(className)) return null;
    seen.add(className);
    const cls = this.classMap.get(className);
    if (!cls) return null;

    // Check attributes
    const attr = cls.attributes.find((a) => a.name === featureName);
    if (attr) {
      return { kind: 'attribute', type: attr.type, many: attr.many, owner: className };
    }
    // Check references
    const ref = cls.references.find((r) => r.name === featureName);
    if (ref) {
      return { kind: 'reference', type: ref.targetClass, many: ref.many, owner: className, targetClass: ref.targetClass, containment: ref.containment };
    }
    // Check operations
    if (cls.operations) {
      const op = cls.operations.find((o) => o.name === featureName);
      if (op) {
        return { kind: 'operation', type: op.returnType, owner: className };
      }
    }
    // Recurse into supertypes
    const supers = this.hierarchy.get(className);
    if (supers) {
      for (const superName of supers) {
        const result = this.findFeatureInHierarchy(superName, featureName, seen);
        if (result) return result;
      }
    }
    return null;
  }

  /**
   * Get hover information at a cursor position.
   */
  hover(expression: string, cursorOffset: number, contextClassName: string): OCLHoverInfo | null {
    // Tokenize to find the token at cursor
    let tokens: Token[];
    try {
      const lexer = new OCLLexer(expression);
      tokens = lexer.tokenize();
    } catch {
      return null;
    }

    // Find token at cursor position
    const token = this.findTokenAtOffset(tokens, cursorOffset);
    if (!token) return null;

    const word = token.value;
    const range = { start: token.position - word.length, end: token.position };

    // Determine what kind of hover info to provide
    if (token.type === TokenType.SELF) {
      return {
        word: 'self',
        range,
        type: contextClassName,
        documentation: `The current context object of type \`${contextClassName}\``,
      };
    }

    if (token.type === TokenType.IDENTIFIER || this.isKeywordToken(token)) {
      return this.hoverIdentifier(expression, word, range, cursorOffset, contextClassName);
    }

    if (token.type === TokenType.NUMBER) {
      const isFloat = word.includes('.');
      return {
        word,
        range,
        type: isFloat ? 'Real' : 'Integer',
        documentation: `Numeric literal: ${word}`,
      };
    }

    if (token.type === TokenType.STRING) {
      return {
        word,
        range,
        type: 'String',
        documentation: `String literal (length: ${word.length})`,
      };
    }

    if (token.type === TokenType.BOOLEAN) {
      return {
        word,
        range,
        type: 'Boolean',
        documentation: `Boolean literal: ${word}`,
      };
    }

    return null;
  }

  private hoverIdentifier(
    expression: string,
    word: string,
    range: { start: number; end: number },
    cursorOffset: number,
    contextClassName: string,
  ): OCLHoverInfo | null {
    // Check if it's a keyword
    const keywordInfo = this.getKeywordHover(word);
    if (keywordInfo) {
      return { word, range, ...keywordInfo };
    }

    // Try to determine if it's after a dot or arrow
    const before = expression.substring(0, range.start).trimEnd();

    if (before.endsWith('.') || before.endsWith('->')) {
      // It's a method/property call — try to infer the receiver type
      const separator = before.endsWith('->') ? '->' : '.';
      const receiverExpr = before.slice(0, before.length - separator.length);
      const receiverType = this.inferType(receiverExpr, contextClassName);

      if (receiverType) {
        // Check if it's a feature of the class (incl. inherited)
        if (receiverType.kind === 'class') {
          const feature = this.findFeatureInHierarchy(receiverType.name, word);
          if (feature) {
            if (feature.kind === 'attribute') {
              const typeStr = this.eTypeToOCL(feature.type, feature.many);
              return {
                word,
                range,
                type: typeStr,
                documentation: `**${word}** : ${typeStr}\n\nAttribute of \`${feature.owner}\``,
              };
            }
            if (feature.kind === 'reference') {
              const typeStr = feature.many ? `Set(${feature.targetClass})` : feature.targetClass;
              return {
                word,
                range,
                type: typeStr,
                documentation: `**${word}** : ${typeStr}\n\nReference to \`${feature.targetClass}\`${feature.containment ? ' (containment)' : ''}`,
              };
            }
            if (feature.kind === 'operation') {
              const opType = this.eTypeToOCL(feature.type);
              return {
                word,
                range,
                type: opType,
                documentation: `**${word}** : ${opType}\n\nOperation of \`${feature.owner}\``,
              };
            }
          }
        }

        // Check standard library operations
        const stdOps = getOperationsForType(receiverType);
        const op = stdOps.find((o) => o.name === word);
        if (op) {
          return this.makeOperationHover(word, range, op, receiverType);
        }

        // Collection operations (after ->)
        if (separator === '->') {
          const collOp = this.getCollectionOpHover(word);
          if (collOp) {
            return { word, range, ...collOp };
          }
        }
      }
    }

    // It's a direct identifier — check context class features (incl. inherited)
    const feature = this.findFeatureInHierarchy(contextClassName, word);
    if (feature) {
      if (feature.kind === 'attribute') {
        const typeStr = this.eTypeToOCL(feature.type, feature.many);
        return {
          word,
          range,
          type: typeStr,
          documentation: `**${word}** : ${typeStr}\n\nAttribute of \`${feature.owner}\``,
        };
      }
      if (feature.kind === 'reference') {
        const typeStr = feature.many ? `Set(${feature.targetClass})` : feature.targetClass;
        return {
          word,
          range,
          type: typeStr,
          documentation: `**${word}** : ${typeStr}\n\nReference to \`${feature.targetClass}\`${feature.containment ? ' (containment)' : ''}`,
        };
      }
      if (feature.kind === 'operation') {
        const opType = this.eTypeToOCL(feature.type);
        return {
          word,
          range,
          type: opType,
          documentation: `**${word}** : ${opType}\n\nOperation of \`${feature.owner}\``,
        };
      }
    }

    // Check if it's a class name
    if (this.classMap.has(word)) {
      const targetCls = this.classMap.get(word)!;
      const attrs = targetCls.attributes.map((a) => a.name).join(', ');
      const refs = targetCls.references.map((r) => r.name).join(', ');
      return {
        word,
        range,
        type: `Class`,
        documentation: `**${word}**${targetCls.abstract ? ' (abstract)' : ''}\n\nAttributes: ${attrs || 'none'}\nReferences: ${refs || 'none'}`,
      };
    }

    return null;
  }

  private makeOperationHover(
    word: string,
    range: { start: number; end: number },
    op: OCLOperationSignature,
    receiverType: OCLType,
  ): OCLHoverInfo {
    const params = op.params?.map((p) => `${p.name}: ${p.type}`).join(', ') ?? '';
    const retTypeStr = typeof op.returnType === 'string' ? op.returnType : typeToString(op.returnType);
    const signature = `${typeToString(receiverType)}.${op.name}(${params}) : ${retTypeStr}`;
    return {
      word,
      range,
      type: retTypeStr,
      signature,
      documentation: op.description ? `${signature}\n\n${op.description}` : signature,
    };
  }

  private getCollectionOpHover(name: string): { type?: string; signature?: string; documentation?: string } | null {
    const ops: Record<string, { ret: string; sig: string; doc: string }> = {
      size: { ret: 'Integer', sig: 'Collection(T)->size() : Integer', doc: 'Returns the number of elements in the collection.' },
      isEmpty: { ret: 'Boolean', sig: 'Collection(T)->isEmpty() : Boolean', doc: 'True if the collection contains no elements.' },
      notEmpty: { ret: 'Boolean', sig: 'Collection(T)->notEmpty() : Boolean', doc: 'True if the collection contains at least one element.' },
      includes: { ret: 'Boolean', sig: 'Collection(T)->includes(obj: T) : Boolean', doc: 'True if obj is an element of the collection.' },
      excludes: { ret: 'Boolean', sig: 'Collection(T)->excludes(obj: T) : Boolean', doc: 'True if obj is not an element of the collection.' },
      includesAll: { ret: 'Boolean', sig: 'Collection(T)->includesAll(c: Collection(T)) : Boolean', doc: 'True if all elements of c are present in this collection.' },
      excludesAll: { ret: 'Boolean', sig: 'Collection(T)->excludesAll(c: Collection(T)) : Boolean', doc: 'True if no element of c is present in this collection.' },
      count: { ret: 'Integer', sig: 'Collection(T)->count(obj: T) : Integer', doc: 'Number of times obj occurs in the collection.' },
      forAll: { ret: 'Boolean', sig: 'Collection(T)->forAll(v: T | expr: Boolean) : Boolean', doc: 'True if expr evaluates to true for every element.' },
      exists: { ret: 'Boolean', sig: 'Collection(T)->exists(v: T | expr: Boolean) : Boolean', doc: 'True if expr evaluates to true for at least one element.' },
      select: { ret: 'Collection(T)', sig: 'Collection(T)->select(v: T | expr: Boolean) : Collection(T)', doc: 'Sub-collection of elements for which expr is true.' },
      reject: { ret: 'Collection(T)', sig: 'Collection(T)->reject(v: T | expr: Boolean) : Collection(T)', doc: 'Sub-collection of elements for which expr is false.' },
      collect: { ret: 'Collection(S)', sig: 'Collection(T)->collect(v: T | expr: S) : Collection(S)', doc: 'Collection of expr results for each element.' },
      closure: { ret: 'Set(T)', sig: 'Collection(T)->closure(v: T | expr) : Set(T)', doc: 'Transitive closure: recursively applies expr until no new elements.' },
      one: { ret: 'Boolean', sig: 'Collection(T)->one(v: T | expr: Boolean) : Boolean', doc: 'True if exactly one element satisfies expr.' },
      any: { ret: 'T', sig: 'Collection(T)->any(v: T | expr: Boolean) : T', doc: 'Returns any element satisfying expr (first found).' },
      isUnique: { ret: 'Boolean', sig: 'Collection(T)->isUnique(v: T | expr) : Boolean', doc: 'True if expr produces a unique value for each element.' },
      sortedBy: { ret: 'OrderedSet(T)', sig: 'Collection(T)->sortedBy(v: T | expr) : OrderedSet(T)', doc: 'Elements sorted by expr value.' },
      iterate: { ret: 'S', sig: 'Collection(T)->iterate(v: T; acc: S = init | expr) : S', doc: 'General iteration with accumulator.' },
      first: { ret: 'T', sig: 'OrderedCollection(T)->first() : T', doc: 'First element of the ordered collection.' },
      last: { ret: 'T', sig: 'OrderedCollection(T)->last() : T', doc: 'Last element of the ordered collection.' },
      at: { ret: 'T', sig: 'OrderedCollection(T)->at(i: Integer) : T', doc: 'Element at 1-based index i.' },
      indexOf: { ret: 'Integer', sig: 'OrderedCollection(T)->indexOf(obj: T) : Integer', doc: '1-based index of first occurrence (0 if not found).' },
      flatten: { ret: 'Collection(T)', sig: 'Collection(Collection(T))->flatten() : Collection(T)', doc: 'Flattens nested collections into a single level.' },
      sum: { ret: 'Real', sig: 'Collection(Number)->sum() : Real', doc: 'Sum of all numeric elements.' },
      min: { ret: 'T', sig: 'Collection(T)->min() : T', doc: 'Minimum element.' },
      max: { ret: 'T', sig: 'Collection(T)->max() : T', doc: 'Maximum element.' },
      asSet: { ret: 'Set(T)', sig: 'Collection(T)->asSet() : Set(T)', doc: 'Converts to Set (removes duplicates).' },
      asBag: { ret: 'Bag(T)', sig: 'Collection(T)->asBag() : Bag(T)', doc: 'Converts to Bag.' },
      asSequence: { ret: 'Sequence(T)', sig: 'Collection(T)->asSequence() : Sequence(T)', doc: 'Converts to Sequence.' },
      asOrderedSet: { ret: 'OrderedSet(T)', sig: 'Collection(T)->asOrderedSet() : OrderedSet(T)', doc: 'Converts to OrderedSet.' },
      reverse: { ret: 'OrderedCollection(T)', sig: 'OrderedCollection(T)->reverse() : OrderedCollection(T)', doc: 'Reverses the order of elements.' },
      union: { ret: 'Collection(T)', sig: 'Collection(T)->union(c: Collection(T)) : Collection(T)', doc: 'Union of two collections.' },
      intersection: { ret: 'Set(T)', sig: 'Set(T)->intersection(s: Set(T)) : Set(T)', doc: 'Elements common to both sets.' },
      symmetricDifference: { ret: 'Set(T)', sig: 'Set(T)->symmetricDifference(s: Set(T)) : Set(T)', doc: 'Elements in one set but not both.' },
      including: { ret: 'Collection(T)', sig: 'Collection(T)->including(obj: T) : Collection(T)', doc: 'Collection with obj added.' },
      excluding: { ret: 'Collection(T)', sig: 'Collection(T)->excluding(obj: T) : Collection(T)', doc: 'Collection with all occurrences of obj removed.' },
      append: { ret: 'Sequence(T)', sig: 'Sequence(T)->append(obj: T) : Sequence(T)', doc: 'Sequence with obj added at the end.' },
      prepend: { ret: 'Sequence(T)', sig: 'Sequence(T)->prepend(obj: T) : Sequence(T)', doc: 'Sequence with obj added at the beginning.' },
      insertAt: { ret: 'Sequence(T)', sig: 'Sequence(T)->insertAt(i: Integer, obj: T) : Sequence(T)', doc: 'Sequence with obj inserted at 1-based position i.' },
      subSequence: { ret: 'Sequence(T)', sig: 'Sequence(T)->subSequence(lower: Integer, upper: Integer) : Sequence(T)', doc: 'Sub-sequence from lower to upper (1-based, inclusive).' },
      subOrderedSet: { ret: 'OrderedSet(T)', sig: 'OrderedSet(T)->subOrderedSet(lower: Integer, upper: Integer) : OrderedSet(T)', doc: 'Sub-ordered-set from lower to upper (1-based, inclusive).' },
      collectNested: { ret: 'Collection(S)', sig: 'Collection(T)->collectNested(v: T | expr: S) : Collection(S)', doc: 'Like collect but preserves nested collections.' },
    };

    const info = ops[name];
    if (!info) return null;
    return {
      type: info.ret,
      signature: info.sig,
      documentation: `${info.sig}\n\n${info.doc}`,
    };
  }

  private getKeywordHover(word: string): { type?: string; documentation?: string } | null {
    const keywords: Record<string, { type?: string; doc: string }> = {
      self: { type: 'context', doc: 'Refers to the current context object.' },
      true: { type: 'Boolean', doc: 'Boolean literal `true`.' },
      false: { type: 'Boolean', doc: 'Boolean literal `false`.' },
      null: { type: 'OclVoid', doc: 'The null value (conforms to all types).' },
      invalid: { type: 'OclInvalid', doc: 'The invalid value (propagates errors).' },
      not: { doc: '`not expr` — Boolean negation.' },
      and: { doc: '`a and b` — Boolean conjunction (short-circuit).' },
      or: { doc: '`a or b` — Boolean disjunction (short-circuit).' },
      xor: { doc: '`a xor b` — Boolean exclusive or.' },
      implies: { doc: '`a implies b` — Boolean implication (false only when a=true, b=false).' },
      div: { doc: '`a div b` — Integer division (truncates toward zero).' },
      mod: { doc: '`a mod b` — Integer remainder.' },
    };

    const info = keywords[word];
    if (!info) return null;
    return { type: info.type, documentation: info.doc };
  }

  // ── Utilities ───────────────────────────────────────────────────

  private findTokenAtOffset(tokens: Token[], offset: number): Token | null {
    for (const token of tokens) {
      if (token.type === TokenType.EOF) continue;
      const end = token.position;
      const start = end - token.value.length;
      if (offset >= start && offset < end) {
        return token;
      }
    }
    return null;
  }

  private isKeywordToken(token: Token): boolean {
    return token.type !== TokenType.IDENTIFIER &&
      token.type !== TokenType.NUMBER &&
      token.type !== TokenType.STRING &&
      token.type !== TokenType.EOF &&
      /^[a-zA-Z]/.test(token.value);
  }

  private inferType(expr: string, contextClassName: string): OCLType | null {
    try {
      const parser = new OCLParser();
      const ast = parser.parse(expr);
      const result = this.inferenceEngine.infer(ast, contextClassName);
      return result.type;
    } catch {
      return null;
    }
  }

  private eTypeToOCL(eType: string, many?: boolean): string {
    let base: string;
    switch (eType) {
      case 'EString': base = 'String'; break;
      case 'EInt': case 'EIntegerObject': base = 'Integer'; break;
      case 'EDouble': case 'EFloat': case 'EDoubleObject': base = 'Real'; break;
      case 'EBoolean': case 'EBooleanObject': base = 'Boolean'; break;
      default: base = eType;
    }
    return many ? `Set(${base})` : base;
  }
}
