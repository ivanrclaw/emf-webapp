import { MTLTypeInference, ScopeVariable } from './MTLTypeInference';

interface DefinitionLocation {
  lineNumber: number;
  column: number;
}

export function createMTLDefinitionProvider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monaco: any,
): { dispose: () => void } {
  const typeInference = new MTLTypeInference();

  const disposable = monaco.languages.registerDefinitionProvider('emf-mtl', {
    provideDefinition(model: { getValue: () => string; getLineContent: (n: number) => string; getLineCount: () => number; uri: unknown }, position: { lineNumber: number; column: number }) {
      const text = model.getValue();
      const line = position.lineNumber;
      const col = position.column;
      const lineContent = model.getLineContent(line);

      const wordInfo = getWordAtPosition(lineContent, col);
      if (!wordInfo) return null;
      const { word } = wordInfo;

      // 1. Variable — go to its declaration
      const variables = typeInference.getVariablesInScope(text, line, col);
      const scopeVar = variables.find((v: ScopeVariable) => v.name === word);
      if (scopeVar && word !== 'self') {
        const declLocation = findVariableDeclaration(text, word, line);
        if (declLocation) {
          return {
            uri: model.uri,
            range: new monaco.Range(
              declLocation.lineNumber,
              declLocation.column,
              declLocation.lineNumber,
              declLocation.column + word.length,
            ),
          };
        }
      }

      // 2. Template invocation — go to template definition
      const templateDef = findTemplateDefinition(text, word);
      if (templateDef) {
        return {
          uri: model.uri,
          range: new monaco.Range(
            templateDef.lineNumber,
            templateDef.column,
            templateDef.lineNumber,
            templateDef.column + word.length,
          ),
        };
      }

      // 3. Query invocation — go to query definition
      const queryDef = findQueryDefinition(text, word);
      if (queryDef) {
        return {
          uri: model.uri,
          range: new monaco.Range(
            queryDef.lineNumber,
            queryDef.column,
            queryDef.lineNumber,
            queryDef.column + word.length,
          ),
        };
      }

      return null;
    },
  });

  return disposable;
}

function getWordAtPosition(line: string, col: number): { word: string; startCol: number; endCol: number } | null {
  const idx = col - 1;
  if (idx < 0 || idx > line.length) return null;
  let start = idx;
  let end = idx;
  while (start > 0 && /\w/.test(line[start - 1])) start--;
  while (end < line.length && /\w/.test(line[end])) end++;
  if (start === end) return null;
  return { word: line.substring(start, end), startCol: start + 1, endCol: end + 1 };
}

function findVariableDeclaration(text: string, varName: string, beforeLine: number): DefinitionLocation | null {
  const lines = text.split('\n');

  for (let i = 0; i < Math.min(beforeLine, lines.length); i++) {
    const line = lines[i];

    // Check template params: [template public name(varName : Type)]
    const templateParamRe = new RegExp(`\\[template\\s+(?:public|private|protected)\\s+\\w+\\([^)]*\\b(${varName})\\s*:`);
    const tMatch = templateParamRe.exec(line);
    if (tMatch) {
      const col = line.indexOf(varName, tMatch.index) + 1;
      return { lineNumber: i + 1, column: col };
    }

    // Check for iterator: [for (varName : Type | ...)]
    const forRe = new RegExp(`\\[for\\s*\\(\\s*(${varName})\\s*:`);
    const fMatch = forRe.exec(line);
    if (fMatch) {
      const col = line.indexOf(varName, fMatch.index) + 1;
      return { lineNumber: i + 1, column: col };
    }

    // Check let binding: [let varName : Type = ...]
    const letRe = new RegExp(`\\[let\\s+(${varName})\\s*:`);
    const lMatch = letRe.exec(line);
    if (lMatch) {
      const col = line.indexOf(varName, lMatch.index) + 1;
      return { lineNumber: i + 1, column: col };
    }
  }

  return null;
}

function findTemplateDefinition(text: string, templateName: string): DefinitionLocation | null {
  const lines = text.split('\n');
  const re = new RegExp(`\\[template\\s+(?:public|private|protected)\\s+(${templateName})\\s*\\(`);

  for (let i = 0; i < lines.length; i++) {
    const match = re.exec(lines[i]);
    if (match) {
      const col = lines[i].indexOf(templateName, match.index) + 1;
      return { lineNumber: i + 1, column: col };
    }
  }
  return null;
}

function findQueryDefinition(text: string, queryName: string): DefinitionLocation | null {
  const lines = text.split('\n');
  const re = new RegExp(`\\[query\\s+(?:public|private|protected)\\s+(${queryName})\\s*\\(`);

  for (let i = 0; i < lines.length; i++) {
    const match = re.exec(lines[i]);
    if (match) {
      const col = lines[i].indexOf(queryName, match.index) + 1;
      return { lineNumber: i + 1, column: col };
    }
  }
  return null;
}
