import { useEffect, useRef } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable } from 'monaco-editor';
import type { CursorPosition, OCLDiagnostic } from './types';

interface OCLEditorPaneProps {
  value: string;
  language: string;
  theme: 'light' | 'dark';
  metamodelContent: any;
  contextClass: string;
  diagnostics: OCLDiagnostic[];
  onChange: (value: string) => void;
  onCursorChange: (pos: CursorPosition) => void;
  onSave: () => void;
  onValidateAll: () => void;
  onFormat: () => void;
  onNew: () => void;
  /** Imperative API for jumping to an offset in the editor. */
  registerEditorAPI?: (api: { revealOffset: (offset: number) => void }) => void;
  /** Callback to expose the Monaco editor instance to the parent. */
  onEditorInstance?: (editor: MonacoEditor.IStandaloneCodeEditor) => void;
}

const EMF_DARK = 'emf-ocl-dark';
const EMF_LIGHT = 'emf-ocl-light';

let themesDefined = false;

function defineThemes(monaco: any) {
  if (themesDefined) return;
  themesDefined = true;

  monaco.editor.defineTheme(EMF_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'string', foreground: '86efac' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'number.float', foreground: 'fbbf24' },
      { token: 'keyword', foreground: 'a78bfa', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '22d3ee' },
      { token: 'type', foreground: '67e8f9' },
      { token: 'identifier', foreground: 'e2e8f0' },
      { token: 'delimiter', foreground: '94a3b8' },
    ],
    colors: {
      'editor.background': '#0f172a',
      'editor.foreground': '#f1f5f9',
      'editor.lineHighlightBackground': '#1e293b80',
      'editor.lineHighlightBorder': '#1e293b00',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#cbd5e1',
      'editorIndentGuide.background': '#1e293b',
      'editorIndentGuide.activeBackground': '#334155',
      'editor.selectionBackground': '#4338ca40',
      'editor.inactiveSelectionBackground': '#33415540',
      'editorCursor.foreground': '#a5b4fc',
      'editorWidget.background': '#0f172a',
      'editorWidget.border': '#334155',
      'editorSuggestWidget.background': '#1e293b',
      'editorSuggestWidget.border': '#334155',
      'editorSuggestWidget.selectedBackground': '#312e8166',
      'editorHoverWidget.background': '#1e293b',
      'editorHoverWidget.border': '#334155',
      'editorGutter.background': '#0f172a',
      'editorBracketMatch.background': '#3730a350',
      'editorBracketMatch.border': '#6366f1',
      'scrollbarSlider.background': '#33415580',
      'scrollbarSlider.hoverBackground': '#475569',
      'minimap.background': '#0f172a',
      'editorRuler.foreground': '#1e293b',
      'editorStickyScroll.background': '#0f172a',
    },
  });

  monaco.editor.defineTheme(EMF_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'string', foreground: '047857' },
      { token: 'number', foreground: 'b45309' },
      { token: 'number.float', foreground: 'b45309' },
      { token: 'keyword', foreground: '6d28d9', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '0e7490' },
      { token: 'type', foreground: '0369a1' },
      { token: 'identifier', foreground: '0f172a' },
      { token: 'delimiter', foreground: '475569' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#0f172a',
      'editor.lineHighlightBackground': '#f1f5f980',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#475569',
      'editorIndentGuide.background': '#e2e8f0',
      'editor.selectionBackground': '#a5b4fc60',
      'editorRuler.foreground': '#e2e8f0',
    },
  });
}

export function OCLEditorPane({
  value,
  language,
  theme,
  metamodelContent: _metamodelContent,
  contextClass: _contextClass,
  diagnostics: _diagnostics,
  onChange,
  onCursorChange,
  onSave,
  onValidateAll,
  onFormat,
  onNew,
  registerEditorAPI,
  onEditorInstance,
}: OCLEditorPaneProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const cmdDisposablesRef = useRef<IDisposable[]>([]);

  // Register save/validate handlers via refs so command bindings see the latest
  const handlersRef = useRef({ onSave, onValidateAll, onFormat, onNew });
  useEffect(() => {
    handlersRef.current = { onSave, onValidateAll, onFormat, onNew };
  }, [onSave, onValidateAll, onFormat, onNew]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    defineThemes(monaco);
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Expose editor instance to parent
    onEditorInstance?.(editor);

    // Register API
    registerEditorAPI?.({
      revealOffset: (offset: number) => {
        const model = editor.getModel();
        if (!model) return;
        const pos = model.getPositionAt(offset);
        editor.revealPositionInCenter(pos, monaco.editor.ScrollType.Smooth);
        editor.setPosition(pos);
        editor.focus();
      },
    });

    // Cursor tracking
    const cursorDisposable = editor.onDidChangeCursorPosition((e: any) => {
      onCursorChange({ line: e.position.lineNumber, column: e.position.column });
    });

    // Keybindings
    const KM = monaco.KeyMod;
    const K = monaco.KeyCode;

    const saveAction = editor.addAction({
      id: 'ocl.save',
      label: 'OCL: Save',
      keybindings: [KM.CtrlCmd | K.KeyS],
      run: () => handlersRef.current.onSave(),
    });

    const validateAction = editor.addAction({
      id: 'ocl.validateAll',
      label: 'OCL: Validate All',
      keybindings: [KM.CtrlCmd | KM.Shift | K.KeyB],
      run: () => handlersRef.current.onValidateAll(),
    });

    const formatAction = editor.addAction({
      id: 'ocl.format',
      label: 'OCL: Format',
      keybindings: [KM.Shift | KM.Alt | K.KeyF],
      run: () => handlersRef.current.onFormat(),
    });

    const newAction = editor.addAction({
      id: 'ocl.new',
      label: 'OCL: New Constraint',
      keybindings: [KM.CtrlCmd | KM.Alt | K.KeyN],
      run: () => handlersRef.current.onNew(),
    });

    cmdDisposablesRef.current = [
      cursorDisposable,
      saveAction,
      validateAction,
      formatAction,
      newAction,
    ];
  };

  useEffect(() => {
    return () => {
      for (const d of cmdDisposablesRef.current) {
        try {
          d.dispose();
        } catch {
          /* noop */
        }
      }
      cmdDisposablesRef.current = [];
    };
  }, []);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(val) => onChange(val ?? '')}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        theme={theme === 'light' ? EMF_LIGHT : EMF_DARK}
        options={{
          minimap: { enabled: true, scale: 2, renderCharacters: false, side: 'right' },
          fontSize: 14,
          lineHeight: 22,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'all',
          smoothScrolling: true,
          cursorSmoothCaretAnimation: 'on',
          cursorBlinking: 'smooth',
          rulers: [100],
          guides: {
            bracketPairs: 'active',
            indentation: true,
            highlightActiveIndentation: true,
          },
          bracketPairColorization: { enabled: true },
          stickyScroll: { enabled: true },
          wordWrap: 'off',
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: false,
          quickSuggestions: { other: true, comments: false, strings: false },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          parameterHints: { enabled: true },
          hover: { enabled: true, delay: 250 },
          renderWhitespace: 'selection',
          occurrencesHighlight: 'singleFile',
          selectionHighlight: true,
          matchBrackets: 'always',
          contextmenu: true,
        }}
      />
    </div>
  );
}

export default OCLEditorPane;
