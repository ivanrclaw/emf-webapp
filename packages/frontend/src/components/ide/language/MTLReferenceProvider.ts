/**
 * MTLReferenceProvider — Find all references of a template/query symbol
 * across all files in the project.
 */
import { ImportResolver } from './ImportResolver';

export interface ReferenceResult {
  fileId: string;
  filename: string;
  line: number;
  col: number;
  endCol: number;
  lineText: string;
  isDefinition: boolean;
}

export class MTLReferenceProvider {
  private importResolver: ImportResolver;

  constructor(importResolver: ImportResolver) {
    this.importResolver = importResolver;
  }

  /**
   * Find all references to a symbol (template or query name) across all project files.
   */
  findReferences(
    symbolName: string,
    files: Array<{ id: string; filename: string; content: string }>,
  ): ReferenceResult[] {
    const results: ReferenceResult[] = [];

    for (const file of files) {
      const lines = file.content.split('\n');

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        // Find all occurrences of the symbol name as a word boundary match
        const regex = new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, 'g');
        let match;

        while ((match = regex.exec(line)) !== null) {
          const col = match.index + 1;
          const endCol = col + symbolName.length;

          // Determine if this is a definition or a reference
          const isDefinition = this.isDefinitionSite(line, symbolName, match.index);

          results.push({
            fileId: file.id,
            filename: file.filename,
            line: lineIdx + 1,
            col,
            endCol,
            lineText: line.trim(),
            isDefinition,
          });
        }
      }
    }

    // Sort: definitions first, then by file, then by line
    results.sort((a, b) => {
      if (a.isDefinition !== b.isDefinition) return a.isDefinition ? -1 : 1;
      if (a.filename !== b.filename) return a.filename.localeCompare(b.filename);
      return a.line - b.line;
    });

    return results;
  }

  /**
   * Get the symbol name at a given position in the text.
   */
  getSymbolAtPosition(text: string, line: number, col: number): string | null {
    const lines = text.split('\n');
    if (line < 1 || line > lines.length) return null;

    const lineText = lines[line - 1];
    if (col < 1 || col > lineText.length + 1) return null;

    // Find word boundaries around the cursor
    const colIdx = col - 1;
    let start = colIdx;
    let end = colIdx;

    while (start > 0 && /\w/.test(lineText[start - 1])) start--;
    while (end < lineText.length && /\w/.test(lineText[end])) end++;

    if (start === end) return null;

    const word = lineText.substring(start, end);

    // Check if it's a template/query name (not a keyword)
    const keywords = new Set([
      'module', 'template', 'query', 'import', 'for', 'if', 'let', 'file',
      'protected', 'public', 'private', 'comment', 'trace', 'else', 'elseif',
      'true', 'false', 'null', 'self', 'extends',
    ]);

    if (keywords.has(word)) return null;

    return word;
  }

  /**
   * Rename a symbol across all files.
   * Returns the edits needed (file id + replacements).
   */
  prepareRename(
    symbolName: string,
    newName: string,
    files: Array<{ id: string; filename: string; content: string }>,
  ): Array<{ fileId: string; filename: string; newContent: string }> {
    const edits: Array<{ fileId: string; filename: string; newContent: string }> = [];

    for (const file of files) {
      const regex = new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, 'g');
      if (regex.test(file.content)) {
        const newContent = file.content.replace(
          new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, 'g'),
          newName,
        );
        edits.push({
          fileId: file.id,
          filename: file.filename,
          newContent,
        });
      }
    }

    return edits;
  }

  private isDefinitionSite(line: string, symbolName: string, matchIndex: number): boolean {
    // Check if this occurrence is in a template/query definition
    const beforeMatch = line.substring(0, matchIndex);

    // Template definition: [template public|private|protected NAME(
    if (/\[template\s+(?:public|private|protected)\s+$/.test(beforeMatch)) return true;

    // Query definition: [query public|private|protected NAME(
    if (/\[query\s+(?:public|private|protected)\s+$/.test(beforeMatch)) return true;

    // Module definition: [module NAME(
    if (/\[module\s+$/.test(beforeMatch)) return true;

    return false;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
