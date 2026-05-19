/**
 * MTLFormatterProvider — Formats MTL templates with proper indentation.
 * Handles block nesting: template, for, if, let, file, protected, trace.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Monaco = any;

export function createMTLFormatterProvider(monaco: Monaco): { dispose: () => void } {
  return monaco.languages.registerDocumentFormattingEditProvider('emf-mtl', {
    provideDocumentFormattingEdits(model: {
      getValue: () => string;
      getLineCount: () => number;
      getLineContent: (n: number) => string;
      getFullModelRange: () => unknown;
    }) {
      const text = model.getValue();
      const formatted = formatMTL(text);

      if (formatted === text) return [];

      return [
        {
          range: model.getFullModelRange(),
          text: formatted,
        },
      ];
    },
  });
}

/**
 * Format an MTL template string with proper indentation.
 */
export function formatMTL(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let indentLevel = 0;
  const indentStr = '  '; // 2 spaces

  const OPEN_RE = /^\s*\[(template|for|if|let|file|protected|trace)\b[^\]]*\]\s*$/;
  const CLOSE_RE = /^\s*\[\/(template|for|if|let|file|protected|trace)\]\s*$/;
  const ELSE_RE = /^\s*\[(else|elseif)\b[^\]]*\]\s*$/;
  const SELF_CLOSE_RE = /^\s*\[[^\]]*\/\]\s*$/;
  const MODULE_RE = /^\s*\[module\b/;
  const IMPORT_RE = /^\s*\[import\b/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty lines: preserve them
    if (trimmed === '') {
      result.push('');
      continue;
    }

    // Closing tag: decrease indent BEFORE writing
    if (CLOSE_RE.test(trimmed)) {
      indentLevel = Math.max(0, indentLevel - 1);
      result.push(indentStr.repeat(indentLevel) + trimmed);
      continue;
    }

    // Else/elseif: decrease indent, write, then increase again
    if (ELSE_RE.test(trimmed)) {
      const dedented = Math.max(0, indentLevel - 1);
      result.push(indentStr.repeat(dedented) + trimmed);
      continue;
    }

    // Module/import: always at indent 0
    if (MODULE_RE.test(trimmed) || IMPORT_RE.test(trimmed)) {
      result.push(trimmed);
      continue;
    }

    // Self-closing tags: write at current indent, no change
    if (SELF_CLOSE_RE.test(trimmed)) {
      result.push(indentStr.repeat(indentLevel) + trimmed);
      continue;
    }

    // Opening tag: write at current indent, then increase
    if (OPEN_RE.test(trimmed)) {
      result.push(indentStr.repeat(indentLevel) + trimmed);
      indentLevel++;
      continue;
    }

    // Regular content: write at current indent
    result.push(indentStr.repeat(indentLevel) + trimmed);
  }

  return result.join('\n');
}
