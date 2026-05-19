/**
 * Signature help provider — shows parameter info when typing
 * inside operation calls like ->select(, ->collect(, etc.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Monaco = any;

interface SignatureDef {
  label: string;
  documentation: string;
  parameters: Array<{ label: string; documentation: string }>;
}

/** OCL collection operations with signatures */
const COLLECTION_SIGNATURES: Record<string, SignatureDef> = {
  select: {
    label: 'select(iterator | condition) : Collection(T)',
    documentation: 'Returns elements where condition evaluates to true.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'condition', documentation: 'Boolean expression to filter by' },
    ],
  },
  reject: {
    label: 'reject(iterator | condition) : Collection(T)',
    documentation: 'Returns elements where condition evaluates to false.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'condition', documentation: 'Boolean expression — elements where this is true are removed' },
    ],
  },
  collect: {
    label: 'collect(iterator | expression) : Collection(R)',
    documentation: 'Transforms each element using the expression.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'expression', documentation: 'Expression to evaluate for each element' },
    ],
  },
  forAll: {
    label: 'forAll(iterator | condition) : Boolean',
    documentation: 'Returns true if condition holds for all elements.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'condition', documentation: 'Boolean condition to check for all elements' },
    ],
  },
  exists: {
    label: 'exists(iterator | condition) : Boolean',
    documentation: 'Returns true if condition holds for at least one element.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'condition', documentation: 'Boolean condition to check' },
    ],
  },
  sortedBy: {
    label: 'sortedBy(iterator | expression) : OrderedSet(T)',
    documentation: 'Returns elements sorted by the expression value.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'expression', documentation: 'Expression to sort by (must be comparable)' },
    ],
  },
  one: {
    label: 'one(iterator | condition) : Boolean',
    documentation: 'Returns true if exactly one element satisfies the condition.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'condition', documentation: 'Boolean condition' },
    ],
  },
  isUnique: {
    label: 'isUnique(iterator | expression) : Boolean',
    documentation: 'Returns true if expression evaluates to a unique value for each element.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'expression', documentation: 'Expression that should be unique' },
    ],
  },
  any: {
    label: 'any(iterator | condition) : T',
    documentation: 'Returns any element satisfying the condition.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'condition', documentation: 'Boolean condition' },
    ],
  },
  closure: {
    label: 'closure(iterator | expression) : Collection(T)',
    documentation: 'Computes the transitive closure of the expression.',
    parameters: [
      { label: 'iterator', documentation: 'Iterator variable name' },
      { label: 'expression', documentation: 'Navigation expression to follow recursively' },
    ],
  },
};

/** String operations with signatures */
const STRING_SIGNATURES: Record<string, SignatureDef> = {
  substring: {
    label: 'substring(startIndex: Integer, endIndex: Integer) : String',
    documentation: 'Returns the substring from startIndex to endIndex (1-based).',
    parameters: [
      { label: 'startIndex: Integer', documentation: 'Start index (1-based, inclusive)' },
      { label: 'endIndex: Integer', documentation: 'End index (1-based, inclusive)' },
    ],
  },
  startsWith: {
    label: 'startsWith(s: String) : Boolean',
    documentation: 'Returns true if the string starts with s.',
    parameters: [{ label: 's: String', documentation: 'Prefix to check' }],
  },
  endsWith: {
    label: 'endsWith(s: String) : Boolean',
    documentation: 'Returns true if the string ends with s.',
    parameters: [{ label: 's: String', documentation: 'Suffix to check' }],
  },
  contains: {
    label: 'contains(s: String) : Boolean',
    documentation: 'Returns true if the string contains s.',
    parameters: [{ label: 's: String', documentation: 'Substring to search for' }],
  },
  replaceAll: {
    label: 'replaceAll(old: String, new: String) : String',
    documentation: 'Replaces all occurrences of old with new.',
    parameters: [
      { label: 'old: String', documentation: 'Pattern to replace' },
      { label: 'new: String', documentation: 'Replacement string' },
    ],
  },
  concat: {
    label: 'concat(s: String) : String',
    documentation: 'Concatenates this string with s.',
    parameters: [{ label: 's: String', documentation: 'String to append' }],
  },
  indexOf: {
    label: 'indexOf(s: String) : Integer',
    documentation: 'Returns the index of the first occurrence of s.',
    parameters: [{ label: 's: String', documentation: 'Substring to find' }],
  },
  matches: {
    label: 'matches(regex: String) : Boolean',
    documentation: 'Returns true if the string matches the regex.',
    parameters: [{ label: 'regex: String', documentation: 'Regular expression pattern' }],
  },
  tokenize: {
    label: 'tokenize(separator: String) : Sequence(String)',
    documentation: 'Splits the string by the separator.',
    parameters: [{ label: 'separator: String', documentation: 'Delimiter to split by' }],
  },
  at: {
    label: 'at(index: Integer) : T',
    documentation: 'Returns the element at the given index (1-based).',
    parameters: [{ label: 'index: Integer', documentation: 'Index (1-based)' }],
  },
  includes: {
    label: 'includes(element: T) : Boolean',
    documentation: 'Returns true if the collection contains the element.',
    parameters: [{ label: 'element: T', documentation: 'Element to check' }],
  },
  excludes: {
    label: 'excludes(element: T) : Boolean',
    documentation: 'Returns true if the collection does not contain the element.',
    parameters: [{ label: 'element: T', documentation: 'Element to check' }],
  },
};

// Merge all signatures
const ALL_SIGNATURES: Record<string, SignatureDef> = {
  ...COLLECTION_SIGNATURES,
  ...STRING_SIGNATURES,
};

/**
 * Create and register the MTL signature help provider.
 * Returns an IDisposable.
 */
export function createMTLSignatureHelpProvider(monaco: Monaco): { dispose: () => void } {
  const disposable = monaco.languages.registerSignatureHelpProvider('emf-mtl', {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideSignatureHelp: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Find the function name before the opening paren
      const funcCallMatch = textUntilPosition.match(
        /(?:->|\.)\s*(\w+)\s*\([^)]*$/,
      );

      if (!funcCallMatch) return null;

      const funcName = funcCallMatch[1];
      const sigDef = ALL_SIGNATURES[funcName];
      if (!sigDef) return null;

      // Determine active parameter by counting commas/pipes after the opening paren
      const afterParen = textUntilPosition.substring(
        textUntilPosition.lastIndexOf('(') + 1,
      );
      // Count separators (both ',' and '|' act as parameter separators in OCL)
      const separators = (afterParen.match(/[,|]/g) || []).length;
      const activeParameter = Math.min(separators, sigDef.parameters.length - 1);

      return {
        value: {
          signatures: [
            {
              label: sigDef.label,
              documentation: { value: sigDef.documentation },
              parameters: sigDef.parameters.map((p) => ({
                label: p.label,
                documentation: { value: p.documentation },
              })),
            },
          ],
          activeSignature: 0,
          activeParameter,
        },
        dispose: () => {},
      };
    },
  });

  return disposable;
}
