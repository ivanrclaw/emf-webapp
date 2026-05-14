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

export default function CodeTemplatePage() {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();

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
    if (!mmid || !pid) return;
    setLoading(true);
    try {
      const [mm, tList, preds] = await Promise.all([
        getMetamodel(pid, mmid),
        getCodeTemplates(mmid),
        getPredefinedGenerators(mmid),
      ]);
      setMetamodel(mm);
      setTemplates(tList);
      setPredefined(preds);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [mmid, pid]);

  useEffect(() => { load(); }, [load]);

  // ── Editor mount ──────────────────────────────────────────────────

  const handleEditorMount: OnMount = (editor) => {
    setTimeout(() => editor.getAction('editor.action.formatDocument')?.run(), 500);
  };

  // ── Save template ─────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!mmid || !formName || !formContent) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCodeTemplate(mmid, editingId, { name: formName, language: formLang, template: formContent });
      } else {
        await createCodeTemplate(mmid, { name: formName, language: formLang, template: formContent });
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [mmid, editingId, formName, formLang, formContent, load]);

  // ── Generate ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (templateId: string) => {
    if (!mmid) return;
    setGenerating(true);
    setOutput(null);
    try {
      const res = await generateFromTemplate(mmid, templateId);
      setOutput(res.files);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [mmid]);

  const handleRunPredefined = useCallback(async (type: string) => {
    if (!mmid) return;
    setGenerating(true);
    setOutput(null);
    try {
      const res = await runPredefinedGenerator(mmid, type);
      setOutput(res.files);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [mmid]);

  // ── Edit / Delete ─────────────────────────────────────────────────

  const startEdit = (t: CodeTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormLang(t.language);
    setFormContent(t.template);
  };

  const handleDelete = async (id: string) => {
    if (!mmid) return;
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteCodeTemplate(mmid, id);
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
          <Link to={`/projects/${pid}`} className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </Link>
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

      {error && <div className="msg msg-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {/* Template Editor */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {editingId ? '✏️ Edit Template' : '➕ New Template'}
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
              theme="vs-dark"
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
            {saving ? 'Saving...' : editingId ? '💾 Update' : '➕ Create'}
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
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{g.description}</div>
          </button>
        ))}
      </div>

      {/* Generation Output */}
      {generating && <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>⏳ Generating...</div>}

      {output && output.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            📄 Generated Files ({output.length})
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
            background: '#0f172a', borderRadius: 6, padding: 12,
            maxHeight: 400, overflow: 'auto',
          }}>
            <pre style={{ margin: 0, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
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
          <span style={{ fontSize: 32 }}>📝</span>
          <p>No custom templates yet</p>
          <p style={{ color: '#64748b', marginTop: 4 }}>
            Create MTL templates above to generate code
          </p>
        </div>
      ) : (
        templates.map((t) => (
          <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: '#1e293b', color: '#94a3b8', textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {t.language}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                {t.description && (
                  <div style={{ fontSize: 11, color: '#64748b' }}>{t.description}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate(t.id)} disabled={generating}>
                  ▶ Generate
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>
                  ✏️
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)} style={{ color: '#ef4444' }}>
                  🗑️
                </button>
              </div>
            </div>
            {/* Preview first 100 chars of template */}
            <div style={{
              fontSize: 11, color: '#475569', marginTop: 6,
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
