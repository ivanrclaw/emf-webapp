/**
 * Context-aware completion provider for MTL/Acceleo.
 * Integrates MetamodelSchemaProvider + MTLTypeInference to provide
 * intelligent suggestions based on cursor context.
 */

import { MetamodelSchemaProvider } from './MetamodelSchemaProvider';
import { MTLTypeInference, type CompletionContext } from './MTLTypeInference';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Monaco = any;

/** Collection operations with iterator signatures */
const COLLECTION_ITERATOR_OPS = [
  { name: 'select', signature: '(iterator | condition)', detail: 'Filter: Collection(T) → Collection(T)', returnInfo: 'Keeps elements where condition is true' },
  { name: 'reject', signature: '(iterator | condition)', detail: 'Reject: Collection(T) → Collection(T)', returnInfo: 'Removes elements where condition is true' },
  { name: 'collect', signature: '(iterator | expression)', detail: 'Map: Collection(T) → Collection(R)', returnInfo: 'Transforms each element' },
  { name: 'forAll', signature: '(iterator | condition)', detail: 'Universal: Collection(T) → Boolean', returnInfo: 'True if all elements satisfy condition' },
  { name: 'exists', signature: '(iterator | condition)', detail: 'Existential: Collection(T) → Boolean', returnInfo: 'True if any element satisfies condition' },
  { name: 'sortedBy', signature: '(iterator | expression)', detail: 'Sort: Collection(T) → OrderedSet(T)', returnInfo: 'Sorts by expression value' },
  { name: 'one', signature: '(iterator | condition)', detail: 'One: Collection(T) → Boolean', returnInfo: 'True if exactly one element satisfies condition' },
  { name: 'isUnique', signature: '(iterator | expression)', detail: 'Unique: Collection(T) → Boolean', returnInfo: 'True if expression is unique for all elements' },
  { name: 'any', signature: '(iterator | condition)', detail: 'Any: Collection(T) → T', returnInfo: 'Returns any element satisfying condition' },
  { name: 'closure', signature: '(iterator | expression)', detail: 'Closure: Collection(T) → Collection(T)', returnInfo: 'Transitive closure of expression' },
  { name: 'collectNested', signature: '(iterator | expression)', detail: 'CollectNested: Collection(T) → Collection(Collection(R))', returnInfo: 'Collect without flattening' },
  { name: 'iterate', signature: '(iterator; resultVar : Type = init | expression)', detail: 'Iterate: Collection(T) → R', returnInfo: 'Accumulate over collection with explicit result variable' },
];

/** Collection operations without iterators */
const COLLECTION_SIMPLE_OPS = [
  { name: 'size()', detail: '→ Integer', doc: 'Number of elements' },
  { name: 'isEmpty()', detail: '→ Boolean', doc: 'True if collection has no elements' },
  { name: 'notEmpty()', detail: '→ Boolean', doc: 'True if collection has elements' },
  { name: 'first()', detail: '→ T', doc: 'First element' },
  { name: 'last()', detail: '→ T', doc: 'Last element' },
  { name: 'at(index)', detail: '→ T', doc: 'Element at index' },
  { name: 'includes(element)', detail: '→ Boolean', doc: 'True if element is in collection' },
  { name: 'excludes(element)', detail: '→ Boolean', doc: 'True if element is not in collection' },
  { name: 'sum()', detail: '→ Integer', doc: 'Sum of numeric elements' },
  { name: 'asSet()', detail: '→ Set(T)', doc: 'Convert to Set' },
  { name: 'asSequence()', detail: '→ Sequence(T)', doc: 'Convert to Sequence' },
  { name: 'asBag()', detail: '→ Bag(T)', doc: 'Convert to Bag (duplicates allowed, no order)' },
  { name: 'asOrderedSet()', detail: '→ OrderedSet(T)', doc: 'Convert to OrderedSet (unique, ordered)' },
  { name: 'flatten()', detail: '→ Collection(T)', doc: 'Flatten nested collections' },
  { name: 'append(element)', detail: '→ Collection(T)', doc: 'Add element at end' },
  { name: 'prepend(element)', detail: '→ Collection(T)', doc: 'Add element at start' },
  { name: 'union(collection)', detail: '→ Collection(T)', doc: 'Union of two collections' },
  { name: 'intersection(collection)', detail: '→ Collection(T)', doc: 'Intersection of two collections' },
  { name: 'including(element)', detail: '→ Collection(T)', doc: 'Collection with element added' },
  { name: 'excluding(element)', detail: '→ Collection(T)', doc: 'Collection with element removed' },
  { name: 'excludesAll(collection)', detail: '→ Boolean', doc: 'True if none of the elements are in collection' },
  { name: 'includesAll(collection)', detail: '→ Boolean', doc: 'True if all elements are in collection' },
  { name: 'count(element)', detail: '→ Integer', doc: 'Number of occurrences of element' },
  { name: 'product(collection)', detail: '→ Set(Tuple)', doc: 'Cartesian product of two collections' },
  { name: 'indexOf(element)', detail: '→ Integer', doc: 'Index of first occurrence of element' },
  { name: 'subSequence(lower, upper)', detail: '→ Sequence(T)', doc: 'Sub-sequence from lower to upper index' },
  { name: 'subOrderedSet(lower, upper)', detail: '→ OrderedSet(T)', doc: 'Sub-ordered set from lower to upper index' },
  { name: 'insertAt(index, element)', detail: '→ Collection(T)', doc: 'Insert element at index' },
  { name: 'reverse()', detail: '→ Collection(T)', doc: 'Reverse order of collection' },
];

/** String operations */
const STRING_OPS = [
  { name: 'toUpper()', detail: '→ String', doc: 'Convert to uppercase' },
  { name: 'toLower()', detail: '→ String', doc: 'Convert to lowercase' },
  { name: 'toUpperFirst()', detail: '→ String', doc: 'Capitalize first letter' },
  { name: 'toLowerFirst()', detail: '→ String', doc: 'Lowercase first letter' },
  { name: 'trim()', detail: '→ String', doc: 'Remove leading/trailing whitespace' },
  { name: 'size()', detail: '→ Integer', doc: 'String length' },
  { name: 'substring(startIndex, endIndex)', detail: '→ String', doc: 'Extract substring' },
  { name: 'startsWith(s)', detail: '→ Boolean', doc: 'True if starts with s' },
  { name: 'endsWith(s)', detail: '→ Boolean', doc: 'True if ends with s' },
  { name: 'contains(s)', detail: '→ Boolean', doc: 'True if contains s' },
  { name: 'replaceAll(old, new)', detail: '→ String', doc: 'Replace all occurrences' },
  { name: 'concat(s)', detail: '→ String', doc: 'Concatenate strings' },
  { name: 'indexOf(s)', detail: '→ Integer', doc: 'Index of first occurrence' },
  { name: 'matches(regex)', detail: '→ Boolean', doc: 'True if matches regex' },
  { name: 'tokenize(separator)', detail: '→ Sequence(String)', doc: 'Split by separator' },
  { name: 'charAt(index)', detail: '→ String', doc: 'Character at given index' },
  { name: 'toInteger()', detail: '→ Integer', doc: 'Convert to integer' },
  { name: 'toReal()', detail: '→ Real', doc: 'Convert to real number' },
  { name: 'toBoolean()', detail: '→ Boolean', doc: 'Convert to boolean (true/false)' },
  { name: 'isAlpha()', detail: '→ Boolean', doc: 'True if string contains only letters' },
  { name: 'isAlphaNum()', detail: '→ Boolean', doc: 'True if string contains only letters and digits' },
  { name: 'equalsIgnoreCase(s)', detail: '→ Boolean', doc: 'Case-insensitive equality check' },
  { name: 'substituteAll(old, new)', detail: '→ String', doc: 'Substitute all occurrences of old substring with new' },
  { name: 'prefix(s)', detail: '→ Boolean', doc: 'True if string has prefix s' },
  { name: 'suffix(s)', detail: '→ Boolean', doc: 'True if string has suffix s' },
  { name: 'lastIndexOf(s)', detail: '→ Integer', doc: 'Index of last occurrence of s' },
  { name: 'split(separator)', detail: '→ Sequence(String)', doc: 'Split string into sequence by separator' },
];

/** Numeric operations */
const NUMERIC_OPS = [
  { name: 'abs()', detail: '→ Integer', doc: 'Absolute value' },
  { name: 'floor()', detail: '→ Integer', doc: 'Floor value' },
  { name: 'round()', detail: '→ Integer', doc: 'Rounded value' },
  { name: 'toString()', detail: '→ String', doc: 'Convert to string' },
  { name: 'div(n)', detail: '→ Integer', doc: 'Integer division' },
  { name: 'mod(n)', detail: '→ Integer', doc: 'Modulo' },
  { name: 'max(n)', detail: '→ Integer', doc: 'Maximum of two values' },
  { name: 'min(n)', detail: '→ Integer', doc: 'Minimum of two values' },
  { name: 'toInteger()', detail: '→ Integer', doc: 'Convert to integer' },
  { name: 'toReal()', detail: '→ Real', doc: 'Convert to real number' },
];

/** Boolean operations */
const BOOLEAN_OPS = [
  { name: 'implies(b)', detail: '→ Boolean', doc: 'True if (!this or b)' },
  { name: 'xor(b)', detail: '→ Boolean', doc: 'Exclusive or with b' },
  { name: 'toString()', detail: '→ String', doc: 'Convert to string representation' },
];

/** Universal OCL type operations (available for all types) */
const OCL_TYPE_OPS = [
  { name: 'oclIsUndefined()', detail: '→ Boolean', doc: 'True if the object is undefined' },
  { name: 'oclIsInvalid()', detail: '→ Boolean', doc: 'True if the object is invalid' },
  { name: 'oclType()', detail: '→ OclType', doc: 'Returns the type of the object' },
  { name: 'allInstances()', detail: '→ Set(Type)', doc: 'All instances of the type in the model (class-level operation)' },
];

/** EMF navigation operations (available for EObject types) */
const EMF_NAVIGATION_OPS = [
  { name: 'eContainer()', detail: '→ EObject', doc: 'Returns the parent container' },
  { name: 'eContainingFeature()', detail: '→ EStructuralFeature', doc: 'Returns the containing feature' },
  { name: 'eContents()', detail: '→ Sequence(EObject)', doc: 'Returns direct children' },
  { name: 'eAllContents()', detail: '→ Sequence(EObject)', doc: 'Returns all descendants (recursive)' },
  { name: 'ancestors()', detail: '→ Sequence(EObject)', doc: 'Returns all ancestors up to root' },
  { name: 'siblings()', detail: '→ Sequence(EObject)', doc: 'Returns other children of the same container' },
];

/** MTL keyword snippets */
function getKeywordSnippets(monaco: Monaco, range: unknown) {
  const M = monaco;
  return [
    {
      label: 'module',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: "module '${1:name}'('${2:nsURI}')/",
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Module declaration',
      sortText: '4_module',
    },
    {
      label: 'import',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'import ${1:qualified::module::name}/',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Import module',
      sortText: '4_import',
    },
    {
      label: 'template',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'template public ${1:name}(${2:param} : ${3:Type})',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Template definition',
      sortText: '4_template',
    },
    {
      label: 'query',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'query public ${1:name}(${2:param} : ${3:Type}) : ${4:ReturnType} = ${5:expression} /',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Query definition',
      sortText: '4_query',
    },
    {
      label: 'file',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: "file ('${1:output.txt}', ${2:false}, 'UTF-8')",
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'File output block',
      sortText: '4_file',
    },
    {
      label: 'for',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: "for (${1:iter} : ${2:Type} | ${3:collection}) separator('${4:, }')",
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'For loop',
      sortText: '4_for',
    },
    {
      label: 'if',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'if (${1:condition})',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'If conditional',
      sortText: '4_if',
    },
    {
      label: 'elseif',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'elseif (${1:condition})',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Else if',
      sortText: '4_elseif',
    },
    { label: 'else', kind: M.languages.CompletionItemKind.Keyword, insertText: 'else', range, detail: 'Else branch', sortText: '4_else' },
    {
      label: 'let',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'let ${1:var} : ${2:Type} = ${3:expression}',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Let variable',
      sortText: '4_let',
    },
    {
      label: 'comment',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'comment ${1:text} /',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Comment',
      sortText: '4_comment',
    },
    {
      label: 'protected',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: "protected id('${1:area}')",
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Protected area',
      sortText: '4_protected',
    },
    {
      label: 'trace',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'trace (${1:message})',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Trace/debug output',
      sortText: '4_trace',
    },
    {
      label: 'overrides',
      kind: M.languages.CompletionItemKind.Keyword,
      insertText: 'overrides',
      range,
      detail: 'Override a template from parent module',
      sortText: '4_overrides',
    },
    {
      label: 'post',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'post(${1:condition})',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Postcondition assertion',
      sortText: '4_post',
    },
    {
      label: 'separator',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: "separator('${1:sep}')",
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Separator for for loop iterations',
      sortText: '4_separator',
    },
    {
      label: 'before',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: "before('${1:text}')",
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Text to emit before first for iteration',
      sortText: '4_before',
    },
    {
      label: 'after',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: "after('${1:text}')",
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Text to emit after last for iteration',
      sortText: '4_after',
    },
    {
      label: 'invoke',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'invoke(${1:template}(${2:params}))',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Invoke a template',
      sortText: '4_invoke',
    },
    {
      label: 'current',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'current()',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'Refer to the current template invocation',
      sortText: '4_current',
    },
    {
      label: 'endif',
      kind: M.languages.CompletionItemKind.Snippet,
      insertText: 'endif]',
      insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: 'End if (with closing bracket)',
      sortText: '4_endif',
    },
    {
      label: 'public',
      kind: M.languages.CompletionItemKind.Keyword,
      insertText: 'public',
      range,
      detail: 'Public visibility modifier',
      sortText: '4_public',
    },
    {
      label: 'private',
      kind: M.languages.CompletionItemKind.Keyword,
      insertText: 'private',
      range,
      detail: 'Private visibility modifier',
      sortText: '4_private',
    },
    {
      label: 'protected',
      kind: M.languages.CompletionItemKind.Keyword,
      insertText: 'protected',
      range,
      detail: 'Protected visibility modifier',
      sortText: '4_protected_vis',
    },
    { label: 'self', kind: M.languages.CompletionItemKind.Keyword, insertText: 'self', range, detail: 'Current context object', sortText: '0_self' },
    { label: 'true', kind: M.languages.CompletionItemKind.Keyword, insertText: 'true', range, detail: 'Boolean true', sortText: '4_true' },
    { label: 'false', kind: M.languages.CompletionItemKind.Keyword, insertText: 'false', range, detail: 'Boolean false', sortText: '4_false' },
    { label: 'null', kind: M.languages.CompletionItemKind.Keyword, insertText: 'null', range, detail: 'Null value', sortText: '4_null' },
  ];
}

/**
 * Create and register the context-aware MTL completion provider.
 * Returns an IDisposable that can be used to unregister the provider.
 */
export function createMTLCompletionProvider(
  monaco: Monaco,
  schemaProvider: MetamodelSchemaProvider | null,
): { dispose: () => void } {
  const typeInference = new MTLTypeInference();

  const disposable = monaco.languages.registerCompletionItemProvider('emf-mtl', {
    triggerCharacters: ['.', '>', '[', ':'],

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCompletionItems: (model: any, position: any) => {
      const text = model.getValue();
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const context: CompletionContext = typeInference.getCompletionContext(
        text,
        position.lineNumber,
        position.column,
        schemaProvider,
      );

      const suggestions: unknown[] = [];

      switch (context.trigger) {
        case 'dot':
          buildDotCompletions(monaco, suggestions, context, schemaProvider, range);
          break;

        case 'arrow':
          buildArrowCompletions(monaco, suggestions, range);
          break;

        case 'type_position':
          buildTypeCompletions(monaco, suggestions, schemaProvider, range);
          break;

        case 'keyword_position':
          suggestions.push(...getKeywordSnippets(monaco, range));
          break;

        case 'general':
          buildGeneralCompletions(monaco, suggestions, context, schemaProvider, range, text);
          break;

        case 'import':
          // For now, just suggest a placeholder
          suggestions.push({
            label: 'org::eclipse::module',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: '${1:org::module::name}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            detail: 'Module import path',
          });
          break;
      }

      return { suggestions };
    },
  });

  return disposable;
}

function buildDotCompletions(
  monaco: Monaco,
  suggestions: unknown[],
  context: CompletionContext,
  schema: MetamodelSchemaProvider | null,
  range: unknown,
): void {
  const resolvedType = context.resolvedType;
  if (!resolvedType) return;

  const typeName = resolvedType.typeName;

  // If it's a collection, suggest collection simple ops with dot syntax
  if (resolvedType.isCollection) {
    for (const op of COLLECTION_SIMPLE_OPS) {
      const insertName = op.name.replace(/\(.*\)/, '');
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    // Universal type ops for all types
    for (const op of OCL_TYPE_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    return;
  }

  // String type
  if (typeName === 'EString' || typeName === 'String') {
    for (const op of STRING_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    // Universal type ops for all types
    for (const op of OCL_TYPE_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    return;
  }

  // Numeric type
  if (typeName === 'EInt' || typeName === 'EFloat' || typeName === 'EDouble' || typeName === 'Integer' || typeName === 'Real') {
    for (const op of NUMERIC_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    // Universal type ops for all types
    for (const op of OCL_TYPE_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    return;
  }

  // Boolean type
  if (typeName === 'EBoolean' || typeName === 'Boolean') {
    for (const op of BOOLEAN_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    // Universal type ops for all types
    for (const op of OCL_TYPE_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }
    return;
  }

  // Schema class — suggest attributes and references
  if (schema) {
    const features = schema.getFeaturesOf(typeName);

    for (const attr of features.attributes) {
      suggestions.push({
        label: attr.name,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: attr.name,
        range,
        detail: `${attr.name} → ${attr.type}`,
        documentation: `Attribute of type ${attr.type}`,
        sortText: `1_${attr.name}`,
      });
    }

    for (const ref of features.references) {
      const typeLabel = ref.isMany ? `Collection(${ref.targetClass})` : ref.targetClass;
      suggestions.push({
        label: ref.name,
        kind: monaco.languages.CompletionItemKind.Reference,
        insertText: ref.name,
        range,
        detail: `${ref.name} → ${typeLabel}`,
        documentation: `${ref.containment ? 'Containment' : 'Cross'}-reference to ${ref.targetClass}${ref.isMany ? ' (many)' : ''}`,
        sortText: `2_${ref.name}`,
      });
    }

    // Also add oclIsKindOf, oclIsTypeOf, oclAsType for any EClass
    suggestions.push(
      {
        label: 'oclIsKindOf(Type)',
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: 'oclIsKindOf(${1:Type})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: '→ Boolean',
        documentation: 'True if object is instance of Type or its subtypes',
        sortText: '3_oclIsKindOf',
      },
      {
        label: 'oclIsTypeOf(Type)',
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: 'oclIsTypeOf(${1:Type})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: '→ Boolean',
        documentation: 'True if object is exactly instance of Type',
        sortText: '3_oclIsTypeOf',
      },
      {
        label: 'oclAsType(Type)',
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: 'oclAsType(${1:Type})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: '→ Type',
        documentation: 'Cast to Type',
        sortText: '3_oclAsType',
      },
    );

    // Universal type ops (oclIsUndefined, oclIsInvalid, oclType, allInstances)
    for (const op of OCL_TYPE_OPS) {
      suggestions.push({
        label: op.name,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: op.name,
        range,
        detail: op.detail,
        documentation: op.doc,
        sortText: `3_${op.name}`,
      });
    }

    // EMF navigation ops for EObject types
    if (typeName !== 'EString' && typeName !== 'EInt' && typeName !== 'EBoolean' && typeName !== 'EFloat' && typeName !== 'EDouble' && typeName !== 'EDate') {
      for (const op of EMF_NAVIGATION_OPS) {
        suggestions.push({
          label: op.name,
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: op.name,
          range,
          detail: op.detail,
          documentation: op.doc,
          sortText: `3_${op.name}`,
        });
      }
    }
  }
}

function buildArrowCompletions(
  monaco: Monaco,
  suggestions: unknown[],
  range: unknown,
): void {
  // Iterator-based operations (includes iterate)
  for (const op of COLLECTION_ITERATOR_OPS) {
    suggestions.push({
      label: op.name + op.signature,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: `${op.name}(\${1:iter} | \${2:expr})`,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: op.detail,
      documentation: op.returnInfo,
      sortText: `3_${op.name}`,
    });
  }

  // Simple collection operations (includes all newly added ops)
  for (const op of COLLECTION_SIMPLE_OPS) {
    suggestions.push({
      label: op.name,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: op.name,
      range,
      detail: op.detail,
      documentation: op.doc,
      sortText: `3_${op.name}`,
    });
  }
}

function buildTypeCompletions(
  monaco: Monaco,
  suggestions: unknown[],
  schema: MetamodelSchemaProvider | null,
  range: unknown,
): void {
  // Built-in types
  const builtins = [
    'EString', 'EInt', 'EBoolean', 'EFloat', 'EDouble', 'EDate',
    'EClass', 'EAttribute', 'EReference', 'EPackage', 'EDataType',
    'EEnum', 'EEnumLiteral', 'EOperation',
    'Collection', 'Sequence', 'Set', 'OrderedSet', 'Bag', 'Tuple',
    'EIntegerObject', 'EFloatObject', 'EBooleanObject',
  ];
  for (const t of builtins) {
    suggestions.push({
      label: t,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: t,
      range,
      detail: 'Built-in type',
      sortText: `1_${t}`,
    });
  }

  // Schema classes
  if (schema) {
    for (const cls of schema.getClasses()) {
      suggestions.push({
        label: cls.name,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: cls.name,
        range,
        detail: cls.isAbstract ? 'Abstract class' : cls.isInterface ? 'Interface' : 'Class',
        documentation: `${cls.attributes.length} attributes, ${cls.references.length} references`,
        sortText: `0_${cls.name}`,
      });
    }

    for (const en of schema.getEnums()) {
      suggestions.push({
        label: en.name,
        kind: monaco.languages.CompletionItemKind.Enum,
        insertText: en.name,
        range,
        detail: 'Enumeration',
        documentation: `Literals: ${en.literals.join(', ')}`,
        sortText: `0_${en.name}`,
      });
    }
  }
}

function buildGeneralCompletions(
  monaco: Monaco,
  suggestions: unknown[],
  context: CompletionContext,
  schema: MetamodelSchemaProvider | null,
  range: unknown,
  text: string,
): void {
  // Variables in scope (highest priority)
  for (const v of context.variablesInScope) {
    const typeLabel = v.type.isCollection ? `Collection(${v.type.typeName})` : v.type.typeName;
    suggestions.push({
      label: v.name,
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: v.name,
      range,
      detail: `${v.source}: ${typeLabel}`,
      sortText: `0_${v.name}`,
    });
  }

  // Template and query name suggestions (for function-call positions)
  // Scan the current module text for template and query definitions
  const templateNameRe = /\[template\s+(?:public|private|protected)\s+(\w+)\s*\(/g;
  let tplMatch;
  while ((tplMatch = templateNameRe.exec(text)) !== null) {
    const name = tplMatch[1];
    suggestions.push({
      label: name,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: name,
      range,
      detail: 'Template (from current module)',
      sortText: `1_${name}`,
    });
  }

  const queryNameRe = /\[query\s+(?:public|private|protected)\s+(\w+)\s*\(/g;
  let qryMatch;
  while ((qryMatch = queryNameRe.exec(text)) !== null) {
    const name = qryMatch[1];
    suggestions.push({
      label: name,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: name,
      range,
      detail: 'Query (from current module)',
      sortText: `1_${name}`,
    });
  }

  // Keywords
  suggestions.push(...getKeywordSnippets(monaco, range));

  // End-block snippets
  const endBlocks = [
    { label: '/template', insertText: '/template]', detail: 'End template' },
    { label: '/for', insertText: '/for]', detail: 'End for loop' },
    { label: '/if', insertText: '/if]', detail: 'End if' },
    { label: '/let', insertText: '/let]', detail: 'End let' },
    { label: '/file', insertText: '/file]', detail: 'End file block' },
    { label: '/protected', insertText: '/protected]', detail: 'End protected area' },
    { label: '/trace', insertText: '/trace]', detail: 'End trace' },
  ];
  for (const eb of endBlocks) {
    suggestions.push({
      label: eb.label,
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: eb.insertText,
      range,
      detail: eb.detail,
      sortText: `5_${eb.label}`,
    });
  }

  // Class names for allInstances pattern
  if (schema) {
    for (const cls of schema.getClasses()) {
      if (!cls.isAbstract && !cls.isInterface) {
        suggestions.push({
          label: cls.name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: cls.name,
          range,
          detail: 'Metamodel class',
          sortText: `3_${cls.name}`,
        });
      }
    }
  }
}
