/**
 * MTL (Acceleo) language registration for Monaco Editor.
 * Extracted from CodeTemplatePage for reuse across the IDE.
 *
 * This file registers the language ID and Monarch tokenizer (syntax highlighting).
 * Completion is now handled separately by the context-aware provider in ./language/.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Monaco = any;

/**
 * Register only the MTL language definition and Monarch tokenizer.
 * Does NOT register any completion provider — that's done by the
 * context-aware provider in EditorPanel.
 */
export function registerMTLLanguageBase(monaco: Monaco): void {
  // Only register once
  const languages = monaco.languages.getLanguages();
  if (languages.some((l: { id: string }) => l.id === 'emf-mtl')) return;

  monaco.languages.register({ id: 'emf-mtl' });

  // Monarch tokenizer
  monaco.languages.setMonarchTokensProvider('emf-mtl', {
    defaultToken: 'text',
    brackets: [{ open: '[', close: ']', token: 'tag' }],
    tokenizer: {
      root: [{ include: '@mttags' }],
      mttags: [
        [/\[([^\]]*\/)\]/, 'tag'],
        [/\[\/(\w+)\]/, 'tag.end'],
        [
          /\[(module|import|template|query|for|if|elseif|else|let|file|protected|trace|comment)\b/,
          { token: 'keyword', next: '@mtlinner' },
        ],
      ],
      mtlinner: [
        [/\/\]/, { token: '@rematch', next: '@pop', switchTo: '@root' }],
        [/\]/, { token: '@rematch', next: '@pop', switchTo: '@root' }],
        [/\b(true|false|null|self)\b/, 'keyword'],
        [
          /\b(forAll|exists|select|reject|collect|collectNested|closure|iterate|any|one|isUnique|sortedBy|size|isEmpty|notEmpty|includes|excludes|first|last|at|sum|min|max|flatten|including|excluding|union|intersection|append|prepend|asSet|asBag|asSequence|asOrderedSet|allInstances)\b/,
          'keyword',
        ],
        [/'.*?'/, 'string'],
        [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        [/[a-zA-Z_]\w*/, 'identifier'],
        [/[=!<>]=?|->|\.|\\+\\-*\/|::/, 'operator'],
        [/[0-9]+(\.[0-9]+)?/, 'number'],
        [/[\(\)]/, 'delimiter.parenthesis'],
        [/\[/, '@brackets'],
      ],
    },
  });

  // Language configuration: brackets, auto-closing, folding, comments
  monaco.languages.setLanguageConfiguration('emf-mtl', {
    // Bracket pairs for matching and highlighting
    brackets: [
      ['[', ']'],
      ['(', ')'],
      ['{', '}'],
    ],
    // Auto-closing pairs
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '{', close: '}' },
      { open: "'", close: "'", notIn: ['string'] },
    ],
    // Surrounding pairs (select text, type bracket → wraps)
    surroundingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: "'", close: "'" },
    ],
    // Comment toggling (Ctrl+/)
    comments: {
      blockComment: ['[comment ', '/]'],
    },
    // Folding markers for region-based folding
    folding: {
      markers: {
        start: /\[(template|for|if|let|file|protected|trace)\b[^\]]*\]/,
        end: /\[\/(template|for|if|let|file|protected|trace)\]/,
      },
    },
    // Indentation rules
    indentationRules: {
      increaseIndentPattern: /\[(template|for|if|else|elseif|let|file|protected|trace)\b[^\]]*\]\s*$/,
      decreaseIndentPattern: /^\s*\[\/(template|for|if|let|file|protected|trace)\]/,
    },
    // On-enter rules for auto-close tags
    onEnterRules: [
      {
        // After [template ...] → indent and prepare [/template]
        beforeText: /\[(template)\s+[^\]]+\]\s*$/,
        afterText: /^\s*\[\/template\]/,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
      },
      {
        beforeText: /\[(for)\s*\([^\]]+\]\s*$/,
        afterText: /^\s*\[\/for\]/,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
      },
      {
        beforeText: /\[(if)\s*\([^\]]+\]\s*$/,
        afterText: /^\s*\[\/if\]/,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
      },
      {
        beforeText: /\[(let)\s+[^\]]+\]\s*$/,
        afterText: /^\s*\[\/let\]/,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
      },
      {
        beforeText: /\[(file)\s*\([^\]]+\]\s*$/,
        afterText: /^\s*\[\/file\]/,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
      },
      {
        beforeText: /\[(protected)\s+[^\]]+\]\s*$/,
        afterText: /^\s*\[\/protected\]/,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
      },
      {
        // Generic: after any opening block tag, indent
        beforeText: /\[(template|for|if|else|elseif|let|file|protected|trace)\b[^\]]*\]\s*$/,
        action: { indentAction: monaco.languages.IndentAction.Indent },
      },
    ],
  });
}

/**
 * Legacy function that registers language + static completions.
 * Kept for backward compatibility with components that don't use the new provider.
 */
export function registerMTLLanguage(monaco: Monaco): void {
  // Only register once
  const languages = monaco.languages.getLanguages();
  if (languages.some((l: { id: string }) => l.id === 'emf-mtl')) return;

  // Register base language
  registerMTLLanguageBase(monaco);

  // Static completion provider (fallback when no metamodel is available)
  const M = monaco;
  M.languages.registerCompletionItemProvider('emf-mtl', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        // Module / Template structure
        {
          label: 'module',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: "module '${1:name}'('${2:nsURI}')/",
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Module declaration',
        },
        {
          label: 'import',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'import ${1:qualified::module::name}/',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Import module',
        },
        {
          label: 'template',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'template public ${1:name}(${2:param} : ${3:Type})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Template definition',
        },
        { label: 'end template', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/template]', range, detail: 'End template' },
        {
          label: 'query',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'query public ${1:name}(${2:param} : ${3:Type}) : ${4:ReturnType} = ${5:expression} /',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Query definition',
        },
        // File
        {
          label: 'file',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: "file ('${1:output.txt}', ${2:false}, 'UTF-8')",
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'File output block',
        },
        { label: 'end file', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/file]', range, detail: 'End file block' },
        // For loop
        {
          label: 'for',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: "for (${1:iter} : ${2:Type} | ${3:collection}) separator('${4:, }')",
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'For loop',
        },
        { label: 'end for', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/for]', range, detail: 'End for loop' },
        // If
        {
          label: 'if',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'if (${1:condition})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'If conditional',
        },
        {
          label: 'elseif',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'elseif (${1:condition})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Else if',
        },
        { label: 'else', kind: M.languages.CompletionItemKind.Snippet, insertText: 'else', range, detail: 'Else branch' },
        { label: 'end if', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/if]', range, detail: 'End if' },
        // Let
        {
          label: 'let',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'let ${1:var} : ${2:Type} = ${3:expression}',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Let variable',
        },
        { label: 'end let', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/let]', range, detail: 'End let' },
        // Comment
        {
          label: 'comment',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'comment ${1:text} /',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Comment',
        },
        { label: 'main', kind: M.languages.CompletionItemKind.Snippet, insertText: 'comment @main/ \n', range, detail: 'Mark as main template' },
        // Protected
        {
          label: 'protected',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: "protected id('${1:area}')",
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Protected area',
        },
        { label: 'end protected', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/protected]', range, detail: 'End protected area' },
        // Trace
        {
          label: 'trace',
          kind: M.languages.CompletionItemKind.Snippet,
          insertText: 'trace (${1:message})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Trace/debug output',
        },
        { label: 'end trace', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/trace]', range, detail: 'End trace' },
        // Keywords
        { label: 'self', kind: M.languages.CompletionItemKind.Keyword, insertText: 'self', range, detail: 'Current context object' },
        { label: 'public', kind: M.languages.CompletionItemKind.Keyword, insertText: 'public', range, detail: 'Public visibility' },
        { label: 'private', kind: M.languages.CompletionItemKind.Keyword, insertText: 'private', range, detail: 'Private visibility' },
        { label: 'overrides', kind: M.languages.CompletionItemKind.Keyword, insertText: 'overrides', range, detail: 'Template override' },
        // Collection ops
        {
          label: '->select',
          kind: M.languages.CompletionItemKind.Function,
          insertText: '->select(${1:iter} | ${2:condition})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Filter collection',
        },
        {
          label: '->collect',
          kind: M.languages.CompletionItemKind.Function,
          insertText: '->collect(${1:iter} | ${2:expr})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Transform collection',
        },
        {
          label: '->forAll',
          kind: M.languages.CompletionItemKind.Function,
          insertText: '->forAll(${1:iter} | ${2:condition})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Universal quantifier',
        },
        {
          label: '->exists',
          kind: M.languages.CompletionItemKind.Function,
          insertText: '->exists(${1:iter} | ${2:condition})',
          insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'Existential quantifier',
        },
        { label: '->size()', kind: M.languages.CompletionItemKind.Function, insertText: '->size()', range, detail: 'Collection size' },
        { label: '->isEmpty()', kind: M.languages.CompletionItemKind.Function, insertText: '->isEmpty()', range, detail: 'Check if empty' },
        { label: '->notEmpty()', kind: M.languages.CompletionItemKind.Function, insertText: '->notEmpty()', range, detail: 'Check if not empty' },
        { label: '->first()', kind: M.languages.CompletionItemKind.Function, insertText: '->first()', range, detail: 'First element' },
      ];

      return { suggestions };
    },
  });
}
