/**
 * OCL Monaco Adapter — Bridges core OCL engines with Monaco Editor.
 *
 * Registers professional completion, hover, and definition providers
 * for the 'emf-ocl' language in Monaco, powered by the core engines.
 */

import type { Monaco } from '@monaco-editor/react';
import type { editor, languages, Position, IDisposable, CancellationToken } from 'monaco-editor';
import {
  OCLCompletionEngine,
  OCLHoverEngine,
  OCLDefinitionEngine,
} from '@emf-webapp/core/ocl';
import type {
  OCLCompletionItem,
  CompletionItemKind as OCLKind,
  OCLHoverInfo,
  OCLDefinitionResult,
  MetamodelInfo,
  MetamodelClass,
} from '@emf-webapp/core/ocl';

// ── Types ─────────────────────────────────────────────────────────

export interface MetamodelContent {
  eClassifiers?: Array<{
    id?: string;
    name: string;
    abstract?: boolean;
    eSuperTypes?: string[];
    eAttributes?: Array<{
      name: string;
      eType?: string;
      lowerBound?: number;
      upperBound?: number;
    }>;
    eReferences?: Array<{
      name: string;
      targetId?: string;
      containment?: boolean;
      lowerBound?: number;
      upperBound?: number;
    }>;
    eOperations?: Array<{
      name: string;
      eType?: string;
      eParameters?: Array<{ name: string; eType?: string }>;
    }>;
  }>;
}

// ── Metamodel Conversion ──────────────────────────────────────────

/**
 * Convert frontend metamodel content to the MetamodelInfo format
 * expected by the core OCL engines.
 */
export function buildMetamodelInfo(content: MetamodelContent): MetamodelInfo {
  const classifiers = content.eClassifiers || [];

  // Build id→name lookup
  const idToName: Record<string, string> = {};
  for (const cls of classifiers) {
    if (cls.id) idToName[cls.id] = cls.name;
    idToName[cls.name] = cls.name;
  }

  // Build hierarchy map
  const hierarchy = new Map<string, string[]>();
  for (const cls of classifiers) {
    if (cls.eSuperTypes && cls.eSuperTypes.length > 0) {
      const parents = cls.eSuperTypes.map((st) => idToName[st] || st);
      hierarchy.set(cls.name, parents);
    }
  }

  // Build classes
  const classes: MetamodelClass[] = classifiers.map((cls) => {
    const attributes = (cls.eAttributes || []).map((a) => ({
      name: a.name,
      type: a.eType || 'EString',
      many: a.upperBound === -1 || (a.upperBound != null && a.upperBound > 1),
    }));

    const references = (cls.eReferences || []).map((r) => ({
      name: r.name,
      targetClass: idToName[r.targetId || ''] || r.targetId || 'EObject',
      many: r.upperBound === -1 || (r.upperBound != null && r.upperBound > 1),
      containment: !!r.containment,
    }));

    const operations = (cls.eOperations || []).map((op) => ({
      name: op.name,
      returnType: op.eType || 'EString',
      params: (op.eParameters || []).map((p) => ({
        name: p.name,
        type: p.eType || 'EString',
      })),
    }));

    return {
      name: cls.name,
      abstract: cls.abstract,
      attributes,
      references,
      operations: operations.length > 0 ? operations : undefined,
    };
  });

  return { classes, hierarchy };
}

// ── Kind Mapping ──────────────────────────────────────────────────

function mapCompletionKind(kind: OCLKind, monaco: Monaco): number {
  const kinds = monaco.languages.CompletionItemKind;
  switch (kind) {
    case 'attribute': return kinds.Field;
    case 'reference': return kinds.Reference;
    case 'operation': return kinds.Method;
    case 'keyword': return kinds.Keyword;
    case 'variable': return kinds.Variable;
    case 'type': return kinds.Class;
    case 'snippet': return kinds.Snippet;
    case 'collectionOp': return kinds.Function;
    default: return kinds.Text;
  }
}

// ── Provider Registration ─────────────────────────────────────────

export interface OCLMonacoProviders {
  disposables: IDisposable[];
  /** Call when context class changes to update providers */
  setContextClass: (className: string) => void;
}

/**
 * Register all OCL IDE providers (completion, hover, definition) for Monaco.
 * Returns disposables for cleanup and a setter for the context class.
 */
export function registerOCLProviders(
  monaco: Monaco,
  metamodelContent: MetamodelContent,
  initialContextClass: string,
): OCLMonacoProviders {
  const metamodelInfo = buildMetamodelInfo(metamodelContent);
  const completionEngine = new OCLCompletionEngine(metamodelInfo);
  const hoverEngine = new OCLHoverEngine(metamodelInfo);
  const definitionEngine = new OCLDefinitionEngine(metamodelInfo);

  let contextClass = initialContextClass;

  const disposables: IDisposable[] = [];

  // ── Completion Provider ───────────────────────────────────────

  disposables.push(
    monaco.languages.registerCompletionItemProvider('emf-ocl', {
      triggerCharacters: ['.', '>', ':'],

      provideCompletionItems(model: any, position: any) {
        const lineContent = model.getLineContent(position.lineNumber);
        const offset = position.column - 1; // Monaco is 1-based
        const expression = lineContent;

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const items = completionEngine.complete(expression, offset, contextClass);

        const suggestions: languages.CompletionItem[] = items.map((item) => {
          const hasSnippet = item.insertText.includes('$');
          return {
            label: item.label,
            kind: mapCompletionKind(item.kind, monaco),
            detail: item.detail,
            documentation: item.documentation
              ? { value: item.documentation, isTrusted: true }
              : undefined,
            insertText: item.insertText,
            insertTextRules: hasSnippet
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            range,
            sortText: String(item.sortOrder).padStart(4, '0'),
          } as languages.CompletionItem;
        });

        return { suggestions };
      },
    }),
  );

  // ── Hover Provider ────────────────────────────────────────────

  disposables.push(
    monaco.languages.registerHoverProvider('emf-ocl', {
      provideHover(model: any, position: any) {
        const lineContent = model.getLineContent(position.lineNumber);
        const offset = position.column - 1;

        const info = hoverEngine.hover(lineContent, offset, contextClass);
        if (!info) return null;

        const contents: Array<{ value: string; isTrusted?: boolean }> = [];

        if (info.signature) {
          contents.push({ value: '```ocl\n' + info.signature + '\n```' });
        } else if (info.type) {
          contents.push({ value: '```ocl\n' + info.word + ' : ' + info.type + '\n```' });
        }

        if (info.documentation) {
          contents.push({ value: info.documentation });
        }

        return {
          contents,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: info.range.start + 1, // Convert to 1-based
            endColumn: info.range.end + 1,
          },
        };
      },
    }),
  );

  // ── Definition Provider ───────────────────────────────────────

  disposables.push(
    monaco.languages.registerDefinitionProvider('emf-ocl', {
      provideDefinition(model: any, position: any) {
        const lineContent = model.getLineContent(position.lineNumber);
        const offset = position.column - 1;

        const result = definitionEngine.findDefinition(lineContent, offset, contextClass);
        if (!result) return null;

        // For metamodel features, we can't navigate to a file,
        // but we can highlight the definition location in the same model.
        // Return the current position as a "peek" definition.
        return {
          uri: model.uri,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: result.range.start + 1,
            endLineNumber: position.lineNumber,
            endColumn: result.range.end + 1,
          },
        };
      },
    }),
  );

  // ── Signature Help Provider ───────────────────────────────────

  disposables.push(
    monaco.languages.registerSignatureHelpProvider('emf-ocl', {
      signatureHelpTriggerCharacters: ['(', ','],

      provideSignatureHelp(model: any, position: any) {
        const lineContent = model.getLineContent(position.lineNumber);
        const offset = position.column - 1;
        const before = lineContent.substring(0, offset);

        // Find the operation name before the opening paren
        const match = before.match(/(\w+)\s*\([^)]*$/);
        if (!match) return null;

        const opName = match[1];
        // Count commas to determine active parameter
        const afterParen = before.substring(before.lastIndexOf('(') + 1);
        const activeParameter = (afterParen.match(/,/g) || []).length;

        // Try to get hover info for the operation to extract signature
        const opStart = before.lastIndexOf(opName);
        const exprBefore = lineContent.substring(0, opStart);
        const info = hoverEngine.hover(
          exprBefore + opName,
          opStart,
          contextClass,
        );

        if (!info || !info.signature) return null;

        return {
          value: {
            signatures: [{
              label: info.signature,
              documentation: info.documentation || '',
              parameters: [],
            }],
            activeSignature: 0,
            activeParameter,
          },
          dispose() {},
        };
      },
    }),
  );

  return {
    disposables,
    setContextClass(className: string) {
      contextClass = className;
    },
  };
}

// ── Monarch Tokenizer ─────────────────────────────────────────────

/**
 * Enhanced Monarch tokenizer for OCL with better highlighting.
 */
export function getOCLMonarchTokens(): any {
  return {
    keywords: [
      'self', 'true', 'false', 'and', 'or', 'not', 'xor', 'implies',
      'let', 'in', 'if', 'then', 'else', 'endif', 'inv', 'pre', 'post',
      'def', 'init', 'derive', 'body', 'package', 'endpackage',
      'context', 'result', 'null', 'invalid', 'div', 'mod',
    ],
    typeKeywords: [
      'String', 'Integer', 'Real', 'Boolean', 'OclVoid', 'OclInvalid', 'OclAny',
      'Set', 'Bag', 'Sequence', 'OrderedSet', 'Tuple', 'Collection',
    ],
    collectionOperations: [
      'forAll', 'exists', 'select', 'reject', 'collect', 'collectNested',
      'closure', 'iterate', 'any', 'one', 'isUnique', 'sortedBy',
      'size', 'isEmpty', 'notEmpty', 'includes', 'excludes',
      'includesAll', 'excludesAll', 'count',
      'first', 'last', 'at', 'indexOf', 'sum', 'min', 'max', 'flatten',
      'including', 'excluding', 'union', 'intersection', 'symmetricDifference',
      'append', 'prepend', 'insertAt', 'reverse',
      'asSet', 'asBag', 'asSequence', 'asOrderedSet',
      'subSequence', 'subOrderedSet',
      'allInstances', 'oclIsKindOf', 'oclIsTypeOf', 'oclAsType',
      'oclIsUndefined', 'oclIsInvalid', 'oclType',
      'substring', 'toUpper', 'toLower', 'concat', 'trim',
      'toInteger', 'toReal', 'toBoolean', 'matches',
      'abs', 'floor', 'round', 'toString',
    ],
    operators: [
      '=', '<>', '>', '<', '>=', '<=', '+', '-', '*', '/',
    ],
    brackets: [
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
      { open: '{', close: '}', token: 'delimiter.curly' },
    ],

    tokenizer: {
      root: [
        // Line comments
        [/--.*$/, 'comment'],

        // Strings
        [/'[^']*'/, 'string'],
        [/"[^"]*"/, 'string'],

        // Numbers
        [/\d*\.\d+([eE][+-]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],

        // Arrow operator
        [/->/, 'keyword.operator'],
        // Double colon
        [/::/, 'delimiter'],
        // @pre
        [/@pre/, 'keyword'],

        // Identifiers and keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@collectionOperations': 'keyword.operator',
            '@default': 'identifier',
          },
        }],

        // Operators
        [/[=<>!+\-*/]/, 'delimiter'],
        [/\|/, 'delimiter'],

        // Brackets
        [/[()]/, '@brackets'],
        [/[{}]/, '@brackets'],

        // Whitespace
        [/\s+/, 'white'],
      ],
    },
  };
}
