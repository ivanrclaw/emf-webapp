/**
 * MTLFoldingProvider — Provides code folding ranges for MTL block tags.
 * Folds template, for, if, let, file, protected, trace blocks.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Monaco = any;

export function createMTLFoldingProvider(monaco: Monaco): { dispose: () => void } {
  return monaco.languages.registerFoldingRangeProvider('emf-mtl', {
    provideFoldingRanges(model: { getLineCount: () => number; getLineContent: (n: number) => string }) {
      const lineCount = model.getLineCount();
      const ranges: Array<{ start: number; end: number; kind?: number }> = [];
      const stack: Array<{ tag: string; line: number }> = [];

      const openRe = /\[(template|for|if|let|file|protected|trace)\b/;
      const closeRe = /\[\/(template|for|if|let|file|protected|trace)\]/;
      const selfCloseRe = /\[[^\]]*\/\]/;

      for (let i = 1; i <= lineCount; i++) {
        const line = model.getLineContent(i);

        // Check for closing tags first
        const closeMatch = closeRe.exec(line);
        if (closeMatch) {
          const closeTag = closeMatch[1];
          // Find matching open in stack
          for (let j = stack.length - 1; j >= 0; j--) {
            if (stack[j].tag === closeTag) {
              ranges.push({
                start: stack[j].line,
                end: i,
                kind: monaco.languages.FoldingRangeKind.Region,
              });
              stack.splice(j, 1);
              break;
            }
          }
          continue;
        }

        // Check for self-closing (skip)
        if (selfCloseRe.test(line) && !openRe.test(line.replace(selfCloseRe, ''))) {
          continue;
        }

        // Check for opening tags
        const openMatch = openRe.exec(line);
        if (openMatch) {
          stack.push({ tag: openMatch[1], line: i });
        }
      }

      // Also fold multi-line comments: [comment ... /] spanning multiple lines
      let commentStart = -1;
      for (let i = 1; i <= lineCount; i++) {
        const line = model.getLineContent(i).trim();
        if (line.startsWith('[comment') && !line.includes('/]')) {
          commentStart = i;
        } else if (commentStart > 0 && line.includes('/]')) {
          ranges.push({
            start: commentStart,
            end: i,
            kind: monaco.languages.FoldingRangeKind.Comment,
          });
          commentStart = -1;
        }
      }

      return ranges;
    },
  });
}
