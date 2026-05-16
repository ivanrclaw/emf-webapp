import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor, { OnMount } from '@monaco-editor/react';
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
