import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import {
  getMetamodel,
  getCodeTemplates,
  createCodeTemplate,
  updateCodeTemplate,
  deleteCodeTemplate,
  generateFromTemplate,
  getPredefinedGenerators,
  runPredefinedGenerator,
  Metamodel,
  CodeTemplate,
  GenerationFile,
  PredefinedGenerator,
} from '../api/client';
import { Save, Plus, FileText, FileCode, Trash2 } from '../components/icons';
import ErrorPanel from '../components/feedback/ErrorPanel';

/* ------------------------------------------------------------------ */
/*  Code Generator Page                                                 */
/* ------------------------------------------------------------------ */

const LANGUAGE_SYNTAXES: Record<string, string> = {
  html: 'html',
  sql: 'sql',
  typescript: 'typescript',
  'json-schema': 'json',
  plantuml: 'plantuml',
  mtl: 'emf-mtl',
};

interface CodeTemplatePageProps {
  projectId?: string;
  metamodelId?: string;
}

export default function CodeTemplatePage(props: CodeTemplatePageProps) {
  const params = useParams<{ pid: string; mmid: string }>();
  const projectId = props.projectId || params.pid || '';
  const metamodelId = props.metamodelId || params.mmid || '';
  const [monacoTheme, setMonacoTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'vs-dark'
  );

  // Sync Monaco theme with app theme toggle
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      setMonacoTheme(theme === 'light' ? 'light' : 'vs-dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [templates, setTemplates] = useState<CodeTemplate[]>([]);
  const [predefined, setPredefined] = useState<PredefinedGenerator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLang, setFormLang] = useState('html');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Generation output
  const [output, setOutput] = useState<GenerationFile[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  // ── Load ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!metamodelId || !projectId) return;
    setLoading(true);
    try {
      const [mm, tList, preds] = await Promise.all([
        getMetamodel(projectId, metamodelId),
        getCodeTemplates(metamodelId),
        getPredefinedGenerators(metamodelId),
      ]);
      setMetamodel(mm);
      setTemplates(tList);
      setPredefined(preds);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [metamodelId, projectId]);

  useEffect(() => { load(); }, [load]);

  // ── Register MTL language ──────────────────────────────────────────

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Register MTL language
    monaco.languages.register({ id: 'emf-mtl' });

    // Tokenizer
    monaco.languages.setMonarchTokensProvider('emf-mtl', {
      defaultToken: 'text',
      brackets: [
        { open: '[', close: ']', token: 'tag' },
      ],
      tokenizer: {
        root: [
          // MTL tags: [...]
          { include: '@mttags' },
        ],
        mttags: [
          // Match [tag content /] or [tag content]...[/tag]
          [/\[([^\]]*\/)\]/, 'tag'],
          [/\[\/(\w+)\]/, 'tag.end'],
          [/\[(module|import|template|query|for|if|elseif|else|let|file|protected|trace|comment)\b/, { token: 'keyword', next: '@mtlinner' }],
        ],
        mtlinner: [
          [/\/\]/, { token: '@rematch', next: '@pop', switchTo: '@root' }],
          [/\]/, { token: '@rematch', next: '@pop', switchTo: '@root' }],
          [/\b(true|false|null|self)\b/, 'keyword'],
          [/\b(forAll|exists|select|reject|collect|collectNested|closure|iterate|any|one|isUnique|sortedBy|size|isEmpty|notEmpty|includes|excludes|first|last|at|sum|min|max|flatten|including|excluding|union|intersection|append|prepend|asSet|asBag|asSequence|asOrderedSet|allInstances)\b/, 'keyword'],
          [/'.*?'/, 'string'],
          [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
          [/[a-zA-Z_]\w*/, 'identifier'],
          [/[=!<>]=?|->|\.|\+\-*\/|::/, 'operator'],
          [/[0-9]+(\.[0-9]+)?/, 'number'],
          [/[\(\)\[\]]/, '@brackets'],
        ],
      },
    });

    // Completion provider
    const M = monaco;
    M.languages.registerCompletionItemProvider('emf-mtl', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [
          // Module / Template structure
          { label: 'module', kind: M.languages.CompletionItemKind.Snippet, insertText: "module '${1:name}'('${2:nsURI}')/", insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Module declaration' },
          { label: 'import', kind: M.languages.CompletionItemKind.Snippet, insertText: 'import ${1:qualified::module::name}/', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Import module' },
          { label: 'template', kind: M.languages.CompletionItemKind.Snippet, insertText: 'template public ${1:name}(${2:param} : ${3:Type})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Template definition' },
          { label: 'end template', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/template]', range, detail: 'End template' },
          { label: 'query', kind: M.languages.CompletionItemKind.Snippet, insertText: 'query public ${1:name}(${2:param} : ${3:Type}) : ${4:ReturnType} = ${5:expression} /', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Query definition' },
          // File
          { label: 'file', kind: M.languages.CompletionItemKind.Snippet, insertText: 'file (\'${1:output.txt}\', ${2:false}, \'UTF-8\')', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'File output block' },
          { label: 'end file', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/file]', range, detail: 'End file block' },
          // For loop
          { label: 'for', kind: M.languages.CompletionItemKind.Snippet, insertText: 'for (${1:iter} : ${2:Type} | ${3:collection}) separator(\'${4:, }\')', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'For loop' },
          { label: 'end for', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/for]', range, detail: 'End for loop' },
          // If
          { label: 'if', kind: M.languages.CompletionItemKind.Snippet, insertText: 'if (${1:condition})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'If conditional' },
          { label: 'elseif', kind: M.languages.CompletionItemKind.Snippet, insertText: 'elseif (${1:condition})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Else if' },
          { label: 'else', kind: M.languages.CompletionItemKind.Snippet, insertText: 'else', range, detail: 'Else branch' },
          { label: 'end if', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/if]', range, detail: 'End if' },
          // Let
          { label: 'let', kind: M.languages.CompletionItemKind.Snippet, insertText: 'let ${1:var} : ${2:Type} = ${3:expression}', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Let variable' },
          { label: 'end let', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/let]', range, detail: 'End let' },
          // Comment
          { label: 'comment', kind: M.languages.CompletionItemKind.Snippet, insertText: 'comment ${1:text} /', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Comment' },
          { label: 'main', kind: M.languages.CompletionItemKind.Snippet, insertText: 'comment @main/ \\n', range, detail: 'Mark as main template' },
          // Protected
          { label: 'protected', kind: M.languages.CompletionItemKind.Snippet, insertText: "protected id('${1:area}')", insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Protected area' },
          { label: 'end protected', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/protected]', range, detail: 'End protected area' },
          // Trace
          { label: 'trace', kind: M.languages.CompletionItemKind.Snippet, insertText: 'trace (${1:message})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Trace/debug output' },
          { label: 'end trace', kind: M.languages.CompletionItemKind.Snippet, insertText: '[/trace]', range, detail: 'End trace' },
          // Keywords
          { label: 'self', kind: M.languages.CompletionItemKind.Keyword, insertText: 'self', range, detail: 'Current context object' },
          { label: 'public', kind: M.languages.CompletionItemKind.Keyword, insertText: 'public', range, detail: 'Public visibility' },
          { label: 'private', kind: M.languages.CompletionItemKind.Keyword, insertText: 'private', range, detail: 'Private visibility' },
          { label: 'protected', kind: M.languages.CompletionItemKind.Keyword, insertText: 'protected', range, detail: 'Protected visibility' },
          { label: 'overrides', kind: M.languages.CompletionItemKind.Keyword, insertText: 'overrides', range, detail: 'Template override' },
          // Collection ops
          { label: '->select', kind: M.languages.CompletionItemKind.Function, insertText: '->select(${1:iter} | ${2:condition})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Filter collection' },
          { label: '->collect', kind: M.languages.CompletionItemKind.Function, insertText: '->collect(${1:iter} | ${2:expr})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Transform collection' },
          { label: '->forAll', kind: M.languages.CompletionItemKind.Function, insertText: '->forAll(${1:iter} | ${2:condition})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Universal quantifier' },
          { label: '->exists', kind: M.languages.CompletionItemKind.Function, insertText: '->exists(${1:iter} | ${2:condition})', insertTextRules: M.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: 'Existential quantifier' },
          { label: '->size()', kind: M.languages.CompletionItemKind.Function, insertText: '->size()', range, detail: 'Collection size' },
          { label: '->isEmpty()', kind: M.languages.CompletionItemKind.Function, insertText: '->isEmpty()', range, detail: 'Check if empty' },
          { label: '->notEmpty()', kind: M.languages.CompletionItemKind.Function, insertText: '->notEmpty()', range, detail: 'Check if not empty' },
          { label: '->first()', kind: M.languages.CompletionItemKind.Function, insertText: '->first()', range, detail: 'First element' },
        ];

        return { suggestions };
      },
    });
  };

  // ── Editor mount ──────────────────────────────────────────────────

  const handleEditorMount: OnMount = (editor) => {
    setTimeout(() => editor.getAction('editor.action.formatDocument')?.run(), 500);
  };

  // ── Save template ─────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!metamodelId || !formName || !formContent) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCodeTemplate(metamodelId, editingId, { name: formName, language: formLang, template: formContent });
      } else {
        await createCodeTemplate(metamodelId, { name: formName, language: formLang, template: formContent });
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [metamodelId, editingId, formName, formLang, formContent, load]);

  // ── Generate ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (templateId: string) => {
    if (!metamodelId) return;
    setGenerating(true);
    setOutput(null);
    try {
      const res = await generateFromTemplate(metamodelId, templateId);
      setOutput(res.files);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [metamodelId]);

  const handleRunPredefined = useCallback(async (type: string) => {
    if (!metamodelId) return;
    setGenerating(true);
    setOutput(null);
    try {
      const res = await runPredefinedGenerator(metamodelId, type);
      setOutput(res.files);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [metamodelId]);

  // ── Edit / Delete ─────────────────────────────────────────────────

  const startEdit = (t: CodeTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormLang(t.language);
    setFormContent(t.template);
  };

  const handleDelete = async (id: string) => {
    if (!metamodelId) return;
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteCodeTemplate(metamodelId, id);
      setTemplates((s) => s.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormLang('html');
    setFormContent('');
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div className="detail-header" style={{ marginBottom: 24 }}>
        <div className="detail-header-left">
          {!props.projectId && (
            <Link to={`/projects/${projectId}`} className="back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
              Back
            </Link>
          )}
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Code Generation — {metamodel?.name}
            </h1>
            <p className="page-subtitle" style={{ marginTop: 2 }}>
              Create MTL templates or use predefined generators
            </p>
          </div>
        </div>
      </div>

      {error && <ErrorPanel title="Error" message={error} compact />}

      {/* Template Editor */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {editingId ? 'Edit Template' : 'New Template'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 12 }}>
          <div className="form-field">
            <label>Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., GenerateHTML"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: '.8125rem',
                fontFamily: 'inherit', background: 'var(--surface)',
              }}
            />
          </div>
          <div className="form-field">
            <label>Language</label>
            <select
              value={formLang}
              onChange={(e) => setFormLang(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: '.8125rem',
                fontFamily: 'inherit', background: 'var(--surface)',
              }}
            >
              <option value="html">HTML</option>
              <option value="sql">SQL</option>
              <option value="typescript">TypeScript</option>
              <option value="json-schema">JSON Schema</option>
              <option value="plantuml">PlantUML</option>
              <option value="mtl">MTL / Acceleo</option>
            </select>
          </div>
        </div>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>MTL Template</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <Editor
              height="250px"
              language={LANGUAGE_SYNTAXES[formLang] || 'html'}
              value={formContent}
              onChange={(val) => setFormContent(val || '')}
              onMount={handleEditorMount}
              beforeMount={handleBeforeMount}
              theme={monacoTheme}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !formName || !formContent}>
            {saving ? 'Saving...' : editingId ? <><Save size={14} /> Update</> : <><Plus size={14} /> Create</>}
          </button>
          {editingId && (
            <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
          )}
        </div>
      </div>

      {/* Predefined Generators */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Predefined Generators</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 20 }}>
        {predefined.map((g) => (
          <button key={g.type} className="card" onClick={() => handleRunPredefined(g.type)} disabled={generating}
            style={{
              padding: 12, cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)',
              transition: 'border-color .15s',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{g.description}</div>
          </button>
        ))}
      </div>

      {/* Generation Output */}
      {generating && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Generating...</div>}

      {output && output.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            <FileText size={14} /> Generated Files ({output.length})
          </div>
          {/* File tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {output.map((f, i) => (
              <button key={f.name}
                className={i === selectedTab ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'}
                onClick={() => setSelectedTab(i)}
              >
                {f.name}
              </button>
            ))}
          </div>
          {/* File content */}
          <div style={{
            background: 'var(--bg)', borderRadius: 6, padding: 12,
            maxHeight: 400, overflow: 'auto',
          }}>
            <pre style={{ margin: 0, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {output[selectedTab]?.content}
            </pre>
          </div>
        </div>
      )}

      {/* Template List */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        Custom Templates ({templates.length})
      </div>
      {templates.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 24px' }}>
          <FileCode size={32} />
          <p>No custom templates yet</p>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Create MTL templates above to generate code
          </p>
        </div>
      ) : (
        templates.map((t) => (
          <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: 'var(--surface)', color: 'var(--text-secondary)', textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {t.language}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                {t.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.description}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate(t.id)} disabled={generating}>
                  ▶ Generate
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {/* Preview first 100 chars of template */}
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t.template.slice(0, 120)}{t.template.length > 120 ? '...' : ''}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
