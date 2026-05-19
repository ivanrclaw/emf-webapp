import { useEffect, useState, useRef } from 'react';
import Editor, { BeforeMount, OnMount } from '@monaco-editor/react';
import { useIDEStore } from './useIDEStore';
import { registerMTLLanguageBase } from './mtl-language';
import {
  MetamodelSchemaProvider,
  MTLDiagnosticEngine,
  createMTLCompletionProvider,
  createMTLSignatureHelpProvider,
  createMTLHoverProvider,
  createMTLDefinitionProvider,
  createMTLFoldingProvider,
  createMTLFormatterProvider,
} from './language';

export function EditorPanel() {
  const { state, dispatch, updateContent, importResolver, openFile } = useIDEStore();
  const { project, activeTab, metamodelContent } = state;

  const [monacoTheme, setMonacoTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'vs-dark',
  );

  // Refs for disposable providers
  const completionDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const signatureDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const hoverDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const definitionDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const foldingDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const formatterDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const crossFileCompletionRef = useRef<{ dispose: () => void } | null>(null);
  const crossFileDefinitionRef = useRef<{ dispose: () => void } | null>(null);
  const monacoRef = useRef<unknown>(null);
  const editorInstanceRef = useRef<unknown>(null);
  const diagnosticEngineRef = useRef<MTLDiagnosticEngine | null>(null);
  const diagnosticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerSupportedRef = useRef(typeof Worker !== 'undefined');

  // Sync Monaco theme with app theme toggle
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      setMonacoTheme(theme === 'light' ? 'light' : 'vs-dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Register/re-register completion provider when metamodel changes
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;

    // Dispose old providers
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
      completionDisposableRef.current = null;
    }
    if (hoverDisposableRef.current) {
      hoverDisposableRef.current.dispose();
      hoverDisposableRef.current = null;
    }

    // Create schema provider from metamodel content
    const schemaProvider = metamodelContent
      ? new MetamodelSchemaProvider(metamodelContent)
      : null;

    // Register new context-aware completion provider
    completionDisposableRef.current = createMTLCompletionProvider(monaco, schemaProvider);

    // Register new hover provider with updated schema
    hoverDisposableRef.current = createMTLHoverProvider(monaco, schemaProvider);

    // Update diagnostic engine schema
    if (diagnosticEngineRef.current) {
      diagnosticEngineRef.current.updateSchema(schemaProvider);
    }
  }, [metamodelContent]);

  // Initialize Web Worker for diagnostics
  useEffect(() => {
    if (!workerSupportedRef.current) return;

    try {
      const worker = new Worker(
        new URL('./language/diagnostics.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'diagnostics') {
          const { fileId, diagnostics } = e.data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const monaco = monacoRef.current as any;
          if (monaco) {
            const models = monaco.editor.getModels();
            const model = models.length > 0 ? models[models.length - 1] : null;
            if (model) {
              const markers = diagnostics.map((d: { line: number; col: number; endLine: number; endCol: number; message: string; severity: string; code?: string }) => ({
                startLineNumber: d.line,
                startColumn: d.col,
                endLineNumber: d.endLine,
                endColumn: d.endCol,
                message: d.message,
                severity:
                  d.severity === 'error'
                    ? monaco.MarkerSeverity.Error
                    : d.severity === 'warning'
                      ? monaco.MarkerSeverity.Warning
                      : monaco.MarkerSeverity.Info,
                code: d.code,
              }));
              monaco.editor.setModelMarkers(model, 'mtl', markers);
            }
          }

          dispatch({
            type: 'SET_DIAGNOSTICS',
            diagnostics: diagnostics.map((d: { line: number; col: number; message: string; severity: string }) => ({
              fileId,
              line: d.line,
              col: d.col,
              message: d.message,
              severity: d.severity,
            })),
          });
        }
      };

      // Send initial schema if available
      if (metamodelContent) {
        worker.postMessage({ type: 'updateSchema', metamodelContent });
      }
    } catch {
      // Worker creation failed, fall back to synchronous
      workerSupportedRef.current = false;
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update worker schema when metamodel changes
  useEffect(() => {
    if (workerRef.current && metamodelContent) {
      workerRef.current.postMessage({ type: 'updateSchema', metamodelContent });
    }
  }, [metamodelContent]);

  // Debounced diagnostics on active file content change
  const activeFile = project?.files.find((f) => f.id === activeTab);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monaco = monacoRef.current as any;
    if (!monaco || !activeFile) return;

    // Clear previous timer
    if (diagnosticTimerRef.current) {
      clearTimeout(diagnosticTimerRef.current);
    }

    diagnosticTimerRef.current = setTimeout(() => {
      // Use worker if available, otherwise fall back to synchronous
      if (workerRef.current) {
        try {
          workerRef.current.postMessage({
            type: 'analyze',
            content: activeFile.content,
            fileId: activeFile.id,
          });
        } catch {
          // Worker may have crashed; fall back to sync diagnostics
          workerSupportedRef.current = false;
          if (diagnosticEngineRef.current) {
            const diagnostics = diagnosticEngineRef.current.analyze(activeFile.content, activeFile.id);
            // Set Monaco markers
            const models = monaco.editor.getModels();
            const model = models.length > 0 ? models[models.length - 1] : null;
            if (model) {
              const markers = diagnostics.map((d) => ({
                startLineNumber: d.line,
                startColumn: d.col,
                endLineNumber: d.endLine,
                endColumn: d.endCol,
                message: d.message,
                severity:
                  d.severity === 'error'
                    ? monaco.MarkerSeverity.Error
                    : d.severity === 'warning'
                      ? monaco.MarkerSeverity.Warning
                      : monaco.MarkerSeverity.Info,
                code: d.code,
              }));
              monaco.editor.setModelMarkers(model, 'mtl', markers);
            }
            // Dispatch to store for StatusBar
            dispatch({
              type: 'SET_DIAGNOSTICS',
              diagnostics: diagnostics.map((d) => ({
                fileId: activeFile.id,
                line: d.line,
                col: d.col,
                message: d.message,
                severity: d.severity,
              })),
            });
          }
        }
      } else if (diagnosticEngineRef.current) {
        const diagnostics = diagnosticEngineRef.current.analyze(activeFile.content, activeFile.id);

        // Set Monaco markers
        const models = monaco.editor.getModels();
        const model = models.length > 0 ? models[models.length - 1] : null;
        if (model) {
          const markers = diagnostics.map((d) => ({
            startLineNumber: d.line,
            startColumn: d.col,
            endLineNumber: d.endLine,
            endColumn: d.endCol,
            message: d.message,
            severity:
              d.severity === 'error'
                ? monaco.MarkerSeverity.Error
                : d.severity === 'warning'
                  ? monaco.MarkerSeverity.Warning
                  : monaco.MarkerSeverity.Info,
            code: d.code,
          }));
          monaco.editor.setModelMarkers(model, 'mtl', markers);
        }

        // Dispatch to store for StatusBar
        dispatch({
          type: 'SET_DIAGNOSTICS',
          diagnostics: diagnostics.map((d) => ({
            fileId: activeFile.id,
            line: d.line,
            col: d.col,
            message: d.message,
            severity: d.severity,
          })),
        });
      }
    }, 300);

    return () => {
      if (diagnosticTimerRef.current) {
        clearTimeout(diagnosticTimerRef.current);
      }
    };
  }, [activeFile?.content, activeFile?.id, dispatch]);

  // Handle cursor navigation requests from OutlinePanel / References
  const { cursorRequest } = state;
  useEffect(() => {
    if (!cursorRequest) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = editorInstanceRef.current as any;
    if (editor) {
      editor.setPosition({ lineNumber: cursorRequest.line, column: cursorRequest.col });
      editor.revealLineInCenter(cursorRequest.line);
      editor.focus();
    }
    dispatch({ type: 'CLEAR_CURSOR_REQUEST' });
  }, [cursorRequest, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
      if (signatureDisposableRef.current) {
        signatureDisposableRef.current.dispose();
      }
      if (hoverDisposableRef.current) {
        hoverDisposableRef.current.dispose();
      }
      if (definitionDisposableRef.current) {
        definitionDisposableRef.current.dispose();
      }
      if (foldingDisposableRef.current) {
        foldingDisposableRef.current.dispose();
      }
      if (formatterDisposableRef.current) {
        formatterDisposableRef.current.dispose();
      }
      if (crossFileCompletionRef.current) {
        crossFileCompletionRef.current.dispose();
      }
      if (crossFileDefinitionRef.current) {
        crossFileDefinitionRef.current.dispose();
      }
      if (diagnosticTimerRef.current) {
        clearTimeout(diagnosticTimerRef.current);
      }
    };
  }, []);

  const handleBeforeMount: BeforeMount = (monaco) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monacoRef.current = monaco as any;

    // Dispose old providers if this is a re-mount (file switch)
    completionDisposableRef.current?.dispose();
    signatureDisposableRef.current?.dispose();
    hoverDisposableRef.current?.dispose();
    definitionDisposableRef.current?.dispose();
    foldingDisposableRef.current?.dispose();
    formatterDisposableRef.current?.dispose();
    crossFileCompletionRef.current?.dispose();
    crossFileDefinitionRef.current?.dispose();
    completionDisposableRef.current = null;
    signatureDisposableRef.current = null;
    hoverDisposableRef.current = null;
    definitionDisposableRef.current = null;
    foldingDisposableRef.current = null;
    formatterDisposableRef.current = null;
    crossFileCompletionRef.current = null;
    crossFileDefinitionRef.current = null;

    // Register language definition + tokenizer (no static completions)
    registerMTLLanguageBase(monaco);

    // Create schema provider from metamodel content
    const schemaProvider = metamodelContent
      ? new MetamodelSchemaProvider(metamodelContent)
      : null;

    // Register context-aware completion provider
    completionDisposableRef.current = createMTLCompletionProvider(monaco, schemaProvider);

    // Register signature help provider
    signatureDisposableRef.current = createMTLSignatureHelpProvider(monaco);

    // Register hover provider
    hoverDisposableRef.current = createMTLHoverProvider(monaco, schemaProvider);

    // Register definition provider (no schema needed)
    definitionDisposableRef.current = createMTLDefinitionProvider(monaco);

    // Register folding provider
    foldingDisposableRef.current = createMTLFoldingProvider(monaco);

    // Register formatter provider
    formatterDisposableRef.current = createMTLFormatterProvider(monaco);

    // Register cross-file completion provider (imported symbols + module names)
    crossFileCompletionRef.current = monaco.languages.registerCompletionItemProvider('emf-mtl', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideCompletionItems(model: any, position: any) {
        if (!importResolver) return { suggestions: [] };
        const text = model.getValue();
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const currentFileId = activeTab;
        if (!currentFileId) return { suggestions: [] };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const suggestions: any[] = [];

        // Check if we're inside an [import ...] context
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        if (/\[import\s+\w*$/.test(textBeforeCursor)) {
          const modules = importResolver.getAvailableModules(currentFileId);
          for (const m of modules) {
            suggestions.push({
              label: m.moduleName,
              kind: monaco.languages.CompletionItemKind.Module,
              detail: `module (${m.filename})`,
              insertText: m.moduleName,
              range,
              sortText: '0' + m.moduleName,
            });
          }
          return { suggestions };
        }

        // Provide imported templates/queries as completions
        const { templates, queries, sourceFiles } = importResolver.getImportedSymbols(text, currentFileId);

        for (const t of templates) {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Function,
            detail: `template ${t.params} (from ${sourceFiles.get(t.name) || '?'})`,
            insertText: t.name,
            range,
            sortText: '1' + t.name,
          });
        }

        for (const q of queries) {
          suggestions.push({
            label: q.name,
            kind: monaco.languages.CompletionItemKind.Method,
            detail: `query : ${q.returnType} (from ${sourceFiles.get(q.name) || '?'})`,
            insertText: `${q.name}()`,
            range,
            sortText: '1' + q.name,
          });
        }

        return { suggestions };
      },
    });

    // Register cross-file definition provider (Ctrl+Click on imported symbols)
    crossFileDefinitionRef.current = monaco.languages.registerDefinitionProvider('emf-mtl', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideDefinition(model: any, position: any) {
        if (!importResolver || !project) return null;

        const lineContent = model.getLineContent(position.lineNumber);
        const wordMatch = model.getWordAtPosition(position);
        if (!wordMatch) return null;
        const word = wordMatch.word;

        // Check if it's an import name: [import moduleName /]
        const importMatch = /\[import\s+(\S+?)\s*\/?\s*\]/.exec(lineContent);
        if (importMatch && importMatch[1] === word) {
          const resolved = importResolver.resolveImport(word);
          if (resolved) {
            // Open the file in a new tab
            openFile(resolved.fileId);
            return null; // Navigation handled by openFile
          }
        }

        // Check if it's a template/query from an imported module
        const defInfo = importResolver.findDefinitionFile(word);
        if (defInfo && defInfo.fileId !== activeTab) {
          openFile(defInfo.fileId);
          // Return a location so Monaco shows the jump
          return null; // Navigation handled by openFile
        }

        return null;
      },
    });

    // Initialize diagnostic engine
    diagnosticEngineRef.current = new MTLDiagnosticEngine(schemaProvider, importResolver);
  };

  const handleChange = (value: string | undefined) => {
    if (activeTab && value !== undefined) {
      updateContent(activeTab, value);
    }
  };

  const handleMount: OnMount = (editor) => {
    editorInstanceRef.current = editor;
  };

  if (!activeFile) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
          background: 'var(--bg)',
        }}
      >
        Select a file from the explorer or create a new one
      </div>
    );
  }

  return (
    <div role="main" aria-label="Code editor" style={{ height: '100%', overflow: 'hidden' }}>
      <Editor
        key={activeFile.id}
        height="100%"
        language="emf-mtl"
        value={activeFile.content}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        theme={monacoTheme}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          fontFamily: "'JetBrains Mono', monospace",
          padding: { top: 8 },
          renderLineHighlight: 'line',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          folding: true,
          foldingStrategy: 'auto',
          showFoldingControls: 'mouseover',
          matchBrackets: 'always',
          autoClosingBrackets: 'always',
          formatOnPaste: false,
        }}
      />
    </div>
  );
}
