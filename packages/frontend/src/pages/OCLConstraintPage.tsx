import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import {
  getMetamodel,
  getOCLConstraints,
  createOCLConstraint,
  updateOCLConstraint,
  deleteOCLConstraint,
  validateOCLConstraints,
  getM1Models,
  Metamodel,
  OCLConstraint,
  OCLValidationResult,
} from '../api/client';
import { Save, Plus, List, Trash2 } from '../components/icons';
import ErrorPanel from '../components/feedback/ErrorPanel';

/* ------------------------------------------------------------------ */
/*  OCL Constraints Page                                               */
/* ------------------------------------------------------------------ */

const SEVERITY_OPTIONS = ['error', 'warning', 'info'] as const;
const SEVERITY_COLORS: Record<string, string> = {
  error: 'var(--danger)',
  warning: '#f59e0b',
  info: '#3b82f6',
};

interface OCLConstraintPageProps {
  projectId?: string;
  metamodelId?: string;
}

export default function OCLConstraintPage(props: OCLConstraintPageProps) {
  const params = useParams<{ pid: string; mmid: string }>();
  const projectId = props.projectId || params.pid || '';
  const metamodelId = props.metamodelId || params.mmid || '';

  const [monacoTheme, setMonacoTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'vs-dark'
  );
  const monacoDisposablesRef = useRef<any[]>([]);

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
  const [constraints, setConstraints] = useState<OCLConstraint[]>([]);
  const [eclassNames, setEclassNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState<OCLValidationResult[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name: string; content: any }>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContext, setFormContext] = useState('');
  const [formExpression, setFormExpression] = useState('');
  const [formSeverity, setFormSeverity] = useState('error');
  const [saving, setSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!metamodelId) return;
    setLoading(true);
    try {
      const [mm, cList, mList] = await Promise.all([
        getMetamodel(projectId, metamodelId),
        getOCLConstraints(metamodelId),
        projectId ? getM1Models(projectId, metamodelId) : Promise.resolve([]),
      ]);
      setMetamodel(mm);
      setConstraints(cList);
      setModels(mList as any);

      // Extract EClass names
      const content = mm.content || {};
      const classifiers: { name: string }[] = content.eClassifiers || [];
      setEclassNames(classifiers.map((c) => c.name));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [metamodelId, projectId]);

  useEffect(() => { load(); }, [load]);

  // ── Monaco Language Registration ─────────────────────────────────

  // Use a ref to always get current formContext
  const formContextRef = useRef(formContext);
  formContextRef.current = formContext;

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Register custom OCL language
    monaco.languages.register({ id: 'emf-ocl' });

    // Import and use the professional tokenizer + providers
    import('./../ocl/oclMonacoAdapter').then(({ registerOCLProviders, getOCLMonarchTokens }) => {
      // Set enhanced Monarch tokens provider
      monaco.languages.setMonarchTokensProvider('emf-ocl', getOCLMonarchTokens() as any);

      // Register professional completion, hover, definition, and signature providers
      const providers = registerOCLProviders(
        monaco,
        metamodel?.content || {},
        formContextRef.current || '',
      );

      // Store disposables for cleanup
      monacoDisposablesRef.current = providers.disposables;

      // Keep context class in sync
      const interval = setInterval(() => {
        providers.setContextClass(formContextRef.current || '');
      }, 500);
      monacoDisposablesRef.current.push({ dispose: () => clearInterval(interval) });
    });
  };

  // ── Editor mount ──────────────────────────────────────────────────

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const diagnosticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // ── Real-time diagnostics (debounced) ─────────────────────────────

  useEffect(() => {
    if (!formExpression || !formContext || !metamodel?.content || !monacoRef.current || !editorRef.current) return;

    if (diagnosticTimerRef.current) clearTimeout(diagnosticTimerRef.current);

    diagnosticTimerRef.current = setTimeout(async () => {
      try {
        const { diagnoseOCLExpression } = await import('../api/client');
        const diagnostics = await diagnoseOCLExpression(
          metamodelId,
          formExpression,
          formContext,
          metamodel.content,
        );

        const monaco = monacoRef.current;
        const model = editorRef.current?.getModel();
        if (!monaco || !model) return;

        const markers = diagnostics.map((d: any) => {
          // Convert offset to line/column
          const startPos = model.getPositionAt(d.offset);
          const endPos = model.getPositionAt(d.offset + (d.length || 1));
          return {
            severity: d.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : d.severity === 'warning'
                ? monaco.MarkerSeverity.Warning
                : monaco.MarkerSeverity.Info,
            message: d.message,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          };
        });

        monaco.editor.setModelMarkers(model, 'ocl-diagnostics', markers);
      } catch {
        // Silently ignore diagnostic errors (network, etc.)
      }
    }, 600);

    return () => {
      if (diagnosticTimerRef.current) clearTimeout(diagnosticTimerRef.current);
    };
  }, [formExpression, formContext, metamodel?.content, metamodelId]);

  // ── Save ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!metamodelId || !formName || !formContext || !formExpression) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateOCLConstraint(metamodelId, editingId, {
          name: formName,
          context: formContext,
          expression: formExpression,
          severity: formSeverity,
        });
      } else {
        await createOCLConstraint(metamodelId, {
          name: formName,
          context: formContext,
          expression: formExpression,
          severity: formSeverity,
        });
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [metamodelId, editingId, formName, formContext, formExpression, formSeverity, load]);

  // ── Validate ──────────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (!metamodelId) return;
    setValidating(true);
    setResults(null);
    try {
      // Use selected model content or metamodel structure as fallback
      const selectedModel = models.find((m) => m.id === selectedModelId);
      const modelContent = selectedModel?.content
        ? JSON.stringify(selectedModel.content)
        : JSON.stringify(metamodel?.content || {});
      const res = await validateOCLConstraints(metamodelId, modelContent);
      setResults(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }, [metamodelId, models, selectedModelId, metamodel]);

  // ── Edit / Delete ─────────────────────────────────────────────────

  const startEdit = (c: OCLConstraint) => {
    setEditingId(c.id);
    setFormName(c.name);
    setFormContext(c.context);
    setFormExpression(c.expression);
    setFormSeverity(c.severity);
  };

  const handleDelete = async (id: string) => {
    if (!metamodelId) return;
    if (!window.confirm('Delete this constraint?')) return;
    try {
      await deleteOCLConstraint(metamodelId, id);
      setConstraints((s) => s.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormContext('');
    setFormExpression('');
    setFormSeverity('error');
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
              OCL Constraints — {metamodel?.name}
            </h1>
            <p className="page-subtitle" style={{ marginTop: 2 }}>
              Define and validate OCL invariants on model instances
            </p>
          </div>
        </div>
      </div>

      {error && <ErrorPanel title="Error" message={error} compact />}

      {/* Form / Editor */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {editingId ? 'Edit Constraint' : 'New Constraint'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-field">
            <label>Name {!formName && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., UniqueName"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: `1px solid ${!formName ? 'var(--danger)' : 'var(--border)'}`, fontSize: '.8125rem',
                fontFamily: 'inherit', background: 'var(--surface)',
              }}
            />
          </div>
          <div className="form-field">
            <label>Context (EClass) {!formContext && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
            <select
              value={formContext}
              onChange={(e) => setFormContext(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: `1px solid ${!formContext ? 'var(--danger)' : 'var(--border)'}`, fontSize: '.8125rem',
                fontFamily: 'inherit', background: 'var(--surface)',
              }}
            >
              <option value="">— Select EClass —</option>
              {eclassNames.map((ec) => (
                <option key={ec} value={ec}>{ec}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Severity</label>
            <select
              value={formSeverity}
              onChange={(e) => setFormSeverity(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: '.8125rem',
                fontFamily: 'inherit', background: 'var(--surface)',
              }}
            >
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>OCL Expression {!formExpression && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <Editor
              height="120px"
              language="emf-ocl"
              value={formExpression}
              onChange={(val) => setFormExpression(val || '')}
              onMount={handleEditorMount}
              beforeMount={handleBeforeMount}
              theme={monacoTheme}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !formName || !formContext || !formExpression}>
            {saving ? 'Saving...' : editingId ? <><Save size={14} /> Update</> : <><Plus size={14} /> Create</>}
          </button>
          {editingId && (
            <button className="btn btn-ghost btn-sm" onClick={resetForm}>
              Cancel
            </button>
          )}
          {(formName || formContext || formExpression) && (!formName || !formContext || !formExpression) && (
            <span style={{ fontSize: 11, color: 'var(--danger)' }}>All fields are required (name, context, expression)</span>
          )}
        </div>
      </div>

      {/* Validate Button + Model Selector + Results */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleValidate} disabled={validating || constraints.length === 0}>
          {validating ? 'Validating...' : 'Validate All'}
        </button>
        {models.length > 0 && (
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 6,
              border: '1px solid var(--border)', fontSize: '.8125rem',
              fontFamily: 'inherit', background: 'var(--surface)',
            }}
          >
            <option value="">Metamodel structure</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name} (M1)</option>
            ))}
          </select>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {constraints.length} constraint{constraints.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Validation Results */}
      {results && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Validation Results
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
              ({results.filter((r) => r.passed).length}/{results.length} passed)
            </span>
          </div>
          {results.map((r) => (
            <div key={r.constraintId} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px',
              marginBottom: 4, borderRadius: 6,
              background: r.passed ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${r.passed ? 'var(--success)' : 'var(--danger)'}`,
            }}>
              <span style={{ fontSize: 14 }}>{r.passed ? '✓' : '✗'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {r.context}: {r.expression}
                </div>
                {r.error && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    {r.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Constraint List */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        All Constraints
      </div>
      {constraints.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 24px' }}>
          <List size={32} />
          <p>No OCL constraints yet</p>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Define invariants to validate model instances
          </p>
        </div>
      ) : (
        constraints.map((c) => (
          <div key={c.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: SEVERITY_COLORS[c.severity] || 'var(--text-muted)',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>context {c.context} inv:</code> {c.expression}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)} style={{ color: 'var(--danger)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
