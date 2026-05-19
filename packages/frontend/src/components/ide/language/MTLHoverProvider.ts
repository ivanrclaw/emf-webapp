import { MetamodelSchemaProvider } from './MetamodelSchemaProvider';
import { MTLTypeInference, ScopeVariable } from './MTLTypeInference';

// Documentation for MTL keywords
const KEYWORD_DOCS: Record<string, { signature: string; description: string; example: string }> = {
  template: {
    signature: '[template visibility name(param : Type)]...[/template]',
    description: 'Defines a code generation template. Templates transform model elements into text output.',
    example: '[template public generateClass(c : EClass)]\npublic class [c.name/] { }\n[/template]',
  },
  for: {
    signature: '[for (iterator : Type | collection)]...[/for]',
    description: 'Iterates over a collection. The iterator variable is available inside the block.',
    example: '[for (attr : EAttribute | c.eAttributes)]\n  private [attr.eType/] [attr.name/];\n[/for]',
  },
  if: {
    signature: '[if (condition)]...[elseif (cond)]...[else]...[/if]',
    description: 'Conditional block. Evaluates the OCL expression and outputs the matching branch.',
    example: '[if (c.abstract)]\nabstract [/if]class [c.name/]',
  },
  let: {
    signature: '[let varName : Type = expression]...[/let]',
    description: 'Declares a local variable with the given type and initial value.',
    example: '[let fullName : String = c.name.toUpperFirst()/]\n[fullName/]\n[/let]',
  },
  file: {
    signature: "[file ('path', overwrite, 'encoding')]...[/file]",
    description: 'Directs output to a file. Path can contain expressions. Overwrite is boolean.',
    example: "[file (c.name.concat('.java'), false, 'UTF-8')]\npackage gen;\n[/file]",
  },
  module: {
    signature: "[module name('metamodel-uri')/]",
    description: 'Declares the module and binds it to a metamodel by its namespace URI.',
    example: "[module generate('http://www.example.org/mymetamodel')/]",
  },
  query: {
    signature: '[query visibility name(param : Type) : ReturnType = expression/]',
    description: 'Defines a reusable OCL expression that can be called from templates.',
    example: "[query public fullName(p : Person) : String = p.firstName.concat(' ').concat(p.lastName)/]",
  },
  import: {
    signature: '[import moduleName/]',
    description: 'Imports templates and queries from another module file.',
    example: '[import common/]',
  },
  protected: {
    signature: "[protected ('id')]...[/protected]",
    description: 'Marks a region that will be preserved across re-generations (user-editable zone).',
    example: "[protected ('custom-imports')]\n// Add your imports here\n[/protected]",
  },
  comment: {
    signature: '[comment description/]',
    description: 'A comment block. Use @main to mark the entry-point template.',
    example: '[comment @main/]',
  },
  trace: {
    signature: '[trace (expression)]...[/trace]',
    description: 'Associates generated text with a model element for traceability.',
    example: '[trace (c)]\n[c.name/]\n[/trace]',
  },
};

// Documentation for OCL collection operations
const OCL_OPERATION_DOCS: Record<string, { signature: string; description: string }> = {
  select: { signature: '->select(iter | condition) : Collection(T)', description: 'Returns elements satisfying the condition.' },
  reject: { signature: '->reject(iter | condition) : Collection(T)', description: 'Returns elements NOT satisfying the condition.' },
  collect: { signature: '->collect(iter | expression) : Collection(R)', description: 'Maps each element to the expression result.' },
  exists: { signature: '->exists(iter | condition) : Boolean', description: 'True if at least one element satisfies the condition.' },
  forAll: { signature: '->forAll(iter | condition) : Boolean', description: 'True if ALL elements satisfy the condition.' },
  isEmpty: { signature: '->isEmpty() : Boolean', description: 'True if the collection has no elements.' },
  notEmpty: { signature: '->notEmpty() : Boolean', description: 'True if the collection has at least one element.' },
  size: { signature: '->size() : Integer', description: 'Returns the number of elements.' },
  first: { signature: '->first() : T', description: 'Returns the first element of the collection.' },
  last: { signature: '->last() : T', description: 'Returns the last element of the collection.' },
  at: { signature: '->at(index : Integer) : T', description: 'Returns the element at the given 1-based index.' },
  sortedBy: { signature: '->sortedBy(iter | expression) : OrderedSet(T)', description: 'Sorts elements by the expression value.' },
  any: { signature: '->any(iter | condition) : T', description: 'Returns any element satisfying the condition.' },
  one: { signature: '->one(iter | condition) : Boolean', description: 'True if exactly one element satisfies the condition.' },
  isUnique: { signature: '->isUnique(iter | expression) : Boolean', description: 'True if expression evaluates to a unique value for each element.' },
  flatten: { signature: '->flatten() : Collection(T)', description: 'Flattens nested collections into a single collection.' },
  asSet: { signature: '->asSet() : Set(T)', description: 'Converts to a Set (removes duplicates).' },
  asSequence: { signature: '->asSequence() : Sequence(T)', description: 'Converts to an ordered Sequence.' },
  includes: { signature: '->includes(element : T) : Boolean', description: 'True if the collection contains the element.' },
  excludes: { signature: '->excludes(element : T) : Boolean', description: 'True if the collection does NOT contain the element.' },
  including: { signature: '->including(element : T) : Collection(T)', description: 'Returns a new collection with the element added.' },
  excluding: { signature: '->excluding(element : T) : Collection(T)', description: 'Returns a new collection with the element removed.' },
  union: { signature: '->union(other : Collection(T)) : Collection(T)', description: 'Returns the union of both collections.' },
  intersection: { signature: '->intersection(other : Collection(T)) : Collection(T)', description: 'Returns elements present in both collections.' },
  sum: { signature: '->sum() : Number', description: 'Returns the sum of numeric elements.' },
  closure: { signature: '->closure(iter | expression) : Collection(T)', description: 'Recursively collects elements following the expression.' },
};

// String operation docs
const STRING_OPERATION_DOCS: Record<string, { signature: string; description: string }> = {
  toUpper: { signature: '.toUpper() : String', description: 'Converts to uppercase.' },
  toLower: { signature: '.toLower() : String', description: 'Converts to lowercase.' },
  toUpperFirst: { signature: '.toUpperFirst() : String', description: 'Capitalizes the first character.' },
  toLowerFirst: { signature: '.toLowerFirst() : String', description: 'Lowercases the first character.' },
  trim: { signature: '.trim() : String', description: 'Removes leading and trailing whitespace.' },
  size: { signature: '.size() : Integer', description: 'Returns the string length.' },
  substring: { signature: '.substring(start : Integer, end : Integer) : String', description: 'Returns substring from start to end (1-based).' },
  startsWith: { signature: '.startsWith(s : String) : Boolean', description: 'True if string starts with s.' },
  endsWith: { signature: '.endsWith(s : String) : Boolean', description: 'True if string ends with s.' },
  contains: { signature: '.contains(s : String) : Boolean', description: 'True if string contains s.' },
  replaceAll: { signature: '.replaceAll(regex : String, replacement : String) : String', description: 'Replaces all regex matches.' },
  concat: { signature: '.concat(s : String) : String', description: 'Concatenates with another string.' },
  indexOf: { signature: '.indexOf(s : String) : Integer', description: 'Returns index of first occurrence (-1 if not found).' },
  matches: { signature: '.matches(regex : String) : Boolean', description: 'True if string matches the regex.' },
  tokenize: { signature: ".tokenize(sep : String) : Sequence(String)", description: 'Splits string by separator.' },
};

export function createMTLHoverProvider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monaco: any,
  schema: MetamodelSchemaProvider | null,
): { dispose: () => void } {
  const typeInference = new MTLTypeInference();

  const disposable = monaco.languages.registerHoverProvider('emf-mtl', {
    provideHover(model: { getValue: () => string; getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) {
      const text = model.getValue();
      const line = position.lineNumber;
      const col = position.column;
      const lineContent = model.getLineContent(line);

      // Get word at position
      const wordInfo = getWordAtPosition(lineContent, col);
      if (!wordInfo) return null;

      const { word, startCol, endCol } = wordInfo;

      // 1. Check if it's an MTL keyword inside a tag
      const keywordDoc = KEYWORD_DOCS[word];
      if (keywordDoc && isInsideTag(lineContent, col)) {
        return {
          range: new monaco.Range(line, startCol, line, endCol),
          contents: [
            { value: `**MTL — ${word}**` },
            { value: '```mtl\n' + keywordDoc.signature + '\n```' },
            { value: keywordDoc.description },
            { value: '```mtl\n' + keywordDoc.example + '\n```' },
          ],
        };
      }

      // 2. Check if it's an OCL collection operation (after ->)
      const textBefore = lineContent.substring(0, startCol - 1);
      if (textBefore.endsWith('->') || textBefore.endsWith('-> ')) {
        const oclDoc = OCL_OPERATION_DOCS[word];
        if (oclDoc) {
          return {
            range: new monaco.Range(line, startCol, line, endCol),
            contents: [
              { value: `**OCL Collection Operation**` },
              { value: '```\n' + oclDoc.signature + '\n```' },
              { value: oclDoc.description },
            ],
          };
        }
      }

      // 3. Check if it's a string/method operation (after .)
      if (textBefore.endsWith('.')) {
        const strDoc = STRING_OPERATION_DOCS[word];
        if (strDoc) {
          return {
            range: new monaco.Range(line, startCol, line, endCol),
            contents: [
              { value: `**String Operation**` },
              { value: '```\n' + strDoc.signature + '\n```' },
              { value: strDoc.description },
            ],
          };
        }
      }

      // 4. Check if it's a variable — show type info
      const variables = typeInference.getVariablesInScope(text, line, col);
      const scopeVar = variables.find((v: ScopeVariable) => v.name === word);
      if (scopeVar) {
        const typeStr = scopeVar.type.isCollection
          ? `Collection(${scopeVar.type.typeName})`
          : scopeVar.type.typeName;
        const sourceLabel = scopeVar.source === 'param' ? 'template parameter'
          : scopeVar.source === 'for' ? 'for iterator'
          : scopeVar.source === 'let' ? 'let binding'
          : 'implicit self';
        return {
          range: new monaco.Range(line, startCol, line, endCol),
          contents: [
            { value: `**${word}** : ${typeStr}` },
            { value: `*(${sourceLabel})*` },
          ],
        };
      }

      // 5. Check if it's a metamodel member access (after a dot on a typed variable)
      if (schema && textBefore.includes('.')) {
        const dotIdx = textBefore.lastIndexOf('.');
        const prefix = textBefore.substring(0, dotIdx);
        const prefixWord = getLastWord(prefix);
        if (prefixWord) {
          const prefixVar = variables.find((v: ScopeVariable) => v.name === prefixWord);
          if (prefixVar) {
            const features = schema.getFeaturesOf(prefixVar.type.typeName);
            const attr = features.attributes.find((a) => a.name === word);
            if (attr) {
              return {
                range: new monaco.Range(line, startCol, line, endCol),
                contents: [
                  { value: `**${word}** : ${attr.type}` },
                  { value: `*attribute of ${prefixVar.type.typeName}*` },
                ],
              };
            }
            const ref = features.references.find((r) => r.name === word);
            if (ref) {
              const typeStr = ref.isMany ? `Collection(${ref.targetClass})` : ref.targetClass;
              const kind = ref.containment ? 'containment reference' : 'reference';
              return {
                range: new monaco.Range(line, startCol, line, endCol),
                contents: [
                  { value: `**${word}** : ${typeStr}` },
                  { value: `*${kind} of ${prefixVar.type.typeName} → ${ref.targetClass}*` },
                ],
              };
            }
          }
        }
      }

      // 6. Check if it's a metamodel class name (in type position)
      if (schema) {
        const cls = schema.getClass(word);
        if (cls) {
          const features = schema.getFeaturesOf(word);
          const attrList = features.attributes.map(a => `  ${a.name} : ${a.type}`).join('\n');
          const refList = features.references.map(r => `  ${r.name} : ${r.isMany ? 'Collection(' + r.targetClass + ')' : r.targetClass}${r.containment ? ' [containment]' : ''}`).join('\n');
          let body = '';
          if (attrList) body += `\nAttributes:\n${attrList}`;
          if (refList) body += `\nReferences:\n${refList}`;
          return {
            range: new monaco.Range(line, startCol, line, endCol),
            contents: [
              { value: `**${word}**${cls.isAbstract ? ' *(abstract)*' : ''}${cls.isInterface ? ' *(interface)*' : ''}` },
              { value: '```\nEClass' + body + '\n```' },
            ],
          };
        }
        const enm = schema.getEnum(word);
        if (enm) {
          const literals = enm.literals?.map(l => `  ${l}`).join('\n') || '  (no literals)';
          return {
            range: new monaco.Range(line, startCol, line, endCol),
            contents: [
              { value: `**${word}** *(EEnum)*` },
              { value: '```\nLiterals:\n' + literals + '\n```' },
            ],
          };
        }
      }

      return null;
    },
  });

  return disposable;
}

function getWordAtPosition(line: string, col: number): { word: string; startCol: number; endCol: number } | null {
  // col is 1-based
  const idx = col - 1;
  if (idx < 0 || idx > line.length) return null;

  let start = idx;
  let end = idx;

  // Expand left
  while (start > 0 && /\w/.test(line[start - 1])) start--;
  // Expand right
  while (end < line.length && /\w/.test(line[end])) end++;

  if (start === end) return null;
  return { word: line.substring(start, end), startCol: start + 1, endCol: end + 1 };
}

function getLastWord(text: string): string | null {
  const match = text.match(/(\w+)\s*$/);
  return match ? match[1] : null;
}

function isInsideTag(line: string, col: number): boolean {
  const before = line.substring(0, col - 1);
  const lastOpen = before.lastIndexOf('[');
  const lastClose = before.lastIndexOf(']');
  return lastOpen > lastClose;
}
