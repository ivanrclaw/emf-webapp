/**
 * OCLDefinitionEngine — Go-to-definition para expresiones OCL.
 *
 * Dado un cursor offset, identifica el símbolo bajo el cursor y
 * devuelve la ubicación de su definición en el metamodelo.
 */

import { OCLLexer, Token, TokenType } from './OCLLexer.js';
import { OCLParser, ASTNode } from './OCLParser.js';
import { OCLType, OCL, typeToString } from './OCLTypes.js';
import {
  OCLTypeInferenceEngine,
  MetamodelInfo,
  MetamodelClass,
} from './OCLTypeInference.js';

// ── Definition Result ─────────────────────────────────────────────

export type DefinitionTargetKind = 'class' | 'attribute' | 'reference' | 'operation' | 'variable';

export interface OCLDefinitionTarget {
  /** Kind of the target symbol */
  kind: DefinitionTargetKind;
  /** Name of the target */
  name: string;
  /** Owning class (for features) */
  ownerClass?: string;
  /** Type of the target */
  type?: string;
  /** Whether it's multi-valued */
  many?: boolean;
  /** Whether it's a containment reference */
  containment?: boolean;
}

export interface OCLDefinitionResult {
  /** The word that was resolved */
  word: string;
  /** Range of the word in the expression */
  range: { start: number; end: number };
  /** The resolved definition target */
  target: OCLDefinitionTarget;
}

// ── Definition Engine ─────────────────────────────────────────────

export class OCLDefinitionEngine {
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
   * Resolve the definition of the symbol at the given cursor position.
   */
  findDefinition(
    expression: string,
    cursorOffset: number,
    contextClassName: string,
  ): OCLDefinitionResult | null {
    // Tokenize
    let tokens: Token[];
    try {
      const lexer = new OCLLexer(expression);
      tokens = lexer.tokenize();
    } catch {
      return null;
    }

    // Find token at cursor
    const token = this.findTokenAtOffset(tokens, cursorOffset);
    if (!token) return null;
    if (token.type !== TokenType.IDENTIFIER && token.type !== TokenType.SELF) return null;

    const word = token.value;
    const range = { start: token.position - word.length, end: token.position };

    // Check if it's a class name
    if (this.classMap.has(word)) {
      const cls = this.classMap.get(word)!;
      return {
        word,
        range,
        target: {
          kind: 'class',
          name: word,
          type: word,
        },
      };
    }

    // Check if it's after a dot or arrow — resolve against receiver type
    const before = expression.substring(0, range.start).trimEnd();

    if (before.endsWith('.') || before.endsWith('->')) {
      const separator = before.endsWith('->') ? '->' : '.';
      const receiverExpr = before.slice(0, before.length - separator.length);
      const receiverType = this.inferType(receiverExpr, contextClassName);

      if (receiverType && receiverType.kind === 'class') {
        const cls = this.classMap.get(receiverType.name);
        if (cls) {
          // Check attributes
          const attr = cls.attributes.find((a) => a.name === word);
          if (attr) {
            return {
              word,
              range,
              target: {
                kind: 'attribute',
                name: word,
                ownerClass: receiverType.name,
                type: attr.type,
                many: attr.many,
              },
            };
          }

          // Check references
          const ref = cls.references.find((r) => r.name === word);
          if (ref) {
            return {
              word,
              range,
              target: {
                kind: 'reference',
                name: word,
                ownerClass: receiverType.name,
                type: ref.targetClass,
                many: ref.many,
                containment: ref.containment,
              },
            };
          }

          // Check operations
          if (cls.operations) {
            const op = cls.operations.find((o) => o.name === word);
            if (op) {
              return {
                word,
                range,
                target: {
                  kind: 'operation',
                  name: word,
                  ownerClass: receiverType.name,
                  type: op.returnType,
                },
              };
            }
          }
        }
      }
    }

    // Direct identifier — resolve against context class
    const cls = this.classMap.get(contextClassName);
    if (cls) {
      const attr = cls.attributes.find((a) => a.name === word);
      if (attr) {
        return {
          word,
          range,
          target: {
            kind: 'attribute',
            name: word,
            ownerClass: contextClassName,
            type: attr.type,
            many: attr.many,
          },
        };
      }

      const ref = cls.references.find((r) => r.name === word);
      if (ref) {
        return {
          word,
          range,
          target: {
            kind: 'reference',
            name: word,
            ownerClass: contextClassName,
            type: ref.targetClass,
            many: ref.many,
            containment: ref.containment,
          },
        };
      }

      if (cls.operations) {
        const op = cls.operations.find((o) => o.name === word);
        if (op) {
          return {
            word,
            range,
            target: {
              kind: 'operation',
              name: word,
              ownerClass: contextClassName,
              type: op.returnType,
            },
          };
        }
      }
    }

    // Check if it's a let variable or iterator variable
    const varDef = this.findVariableDefinition(expression, word, range.start);
    if (varDef) {
      return { word, range, target: varDef };
    }

    return null;
  }

  /**
   * Try to find a let or iterator variable definition in the expression.
   */
  private findVariableDefinition(
    expression: string,
    varName: string,
    useOffset: number,
  ): OCLDefinitionTarget | null {
    // Simple heuristic: look for 'let varName =' or 'varName |' patterns before the use
    const before = expression.substring(0, useOffset);

    // Check for let binding: let varName = ...
    const letPattern = new RegExp(`\\blet\\s+${this.escapeRegex(varName)}\\s*=`);
    if (letPattern.test(before)) {
      return {
        kind: 'variable',
        name: varName,
      };
    }

    // Check for iterator variable: varName |
    const iterPattern = new RegExp(`\\b${this.escapeRegex(varName)}\\s*\\|`);
    if (iterPattern.test(before)) {
      return {
        kind: 'variable',
        name: varName,
      };
    }

    // Check for iterator variable: (varName |
    const iterPattern2 = new RegExp(`\\(\\s*${this.escapeRegex(varName)}\\s*\\|`);
    if (iterPattern2.test(before)) {
      return {
        kind: 'variable',
        name: varName,
      };
    }

    return null;
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

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
