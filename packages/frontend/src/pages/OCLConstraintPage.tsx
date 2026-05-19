import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getMetamodel,
  getOCLConstraints,
  createOCLConstraint,
  updateOCLConstraint,
  deleteOCLConstraint,
  validateOCLConstraints,
  diagnoseOCLExpression,
  getM1Models,
  Metamodel,
  OCLConstraint,
  OCLValidationResult,
} from '../api/client';
import ErrorPanel from '../components/feedback/ErrorPanel';

import { OCLToolbar } from '../components/ocl/OCLToolbar';
import { OCLConstraintBrowser } from '../components/ocl/OCLConstraintBrowser';
import { OCLEditorPane } from '../components/ocl/OCLEditorPane';
import { OCLInspector } from '../components/ocl/OCLInspector';
import { OCLProblemsPanel } from '../components/ocl/OCLProblemsPanel';
import { OCLStatusBar } from '../components/ocl/OCLStatusBar';
import { ResizablePanel } from '../components/workspace/ResizablePanel';
import { ResizablePanelV } from '../components/workspace/ResizablePanelV';
import type {
  ConstraintFormState,
  CursorPosition,
  DiagnosticsMap,
  OCLDiagnostic,
  RunSummaries,
} from '../components/ocl/types';
import {
  isFormEqual,
  offsetToLineColumn,
  runStatusFromResult,
} from '../components/ocl/types';

interface OCLConstraintPageProps {
  projectId?: string;
  metamodelId?: string;
}

const EMPTY_FORM: ConstraintFormState = {
  name: '',
  context: '',
  expression: '',
  severity: 'error',
};

function isFormEqualLocal(a: ConstraintFormState, c: OCLConstraint | null): boolean {
  return isFormEqual(a, c);
}

export default function OCLConstraintPage(props: OCLConstraintPageProps) {
  const params = useParams<{ pid: string; mmid: string }>();
  const projectId = props.projectId || params.pid || '';
  const metamodelId = props.metamodelId || params.mmid || '';

  // ── Theme sync ─────────────────────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme');
      setTheme(t === 'light' ? 'light' : 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // ── Data ──────────────────────────────────────────────────
  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [constraints, setConstraints] = useState<OCLConstraint[]>([]);
  const [models, setModels] = useState<Array<{ id: string; name: string; content: any }>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Selection / form ──────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<ConstraintFormState>(EMPTY_FORM);

  // ── Engine state ──────────────────────────────────────────
  const [diagnosticsMap, setDiagnosticsMap] = useState<DiagnosticsMap>({});
  const [validationResults, setValidationResults] = useState<OCLValidationResult[] | null>(null);
  const [runSummaries, setRunSummaries] = useState<RunSummaries>({});
  const [cursor, setCursor] = useState<CursorPosition | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [problemsVisible, setProblemsVisible] = useState(true);

  const eclassNames = useMemo(() => {
    const content = metamodel?.content || {};
    const classifiers: { name: string }[] = content.eClassifiers || [];
    return classifiers.map((c) => c.name);
  }, [metamodel]);

  const selectedConstraint = useMemo(
    () => constraints.find((c) => c.id === selectedId) || null,
    [constraints, selectedId],
  );

  const dirty = useMemo(() => {
    if (isNew) return form.name !== '' || form.context !== '' || form.expression !== '';
    if (!selectedConstraint) return false;
    return !isFormEqualLocal(form, selectedConstraint);
  }, [form, selectedConstraint, isNew]);

  // ── Load ──────────────────────────────────────────────────
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

      // Pick a constraint to focus
      const stored = (() => {
        try {
          return localStorage.getItem(`ocl-ide.last:${metamodelId}`);
        } catch {
          return null;
        }
      })();
      const initial = (stored && cList.find((c) => c.id === stored)) || cList[0];
      if (initial) {
        setSelectedId(initial.id);
        setIsNew(false);
        setForm({
          name: initial.name,
          context: initial.context,
          expression: initial.expression,
          severity: initial.severity,
        });
      } else {
        setSelectedId(null);
        setForm(EMPTY_FORM);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [metamodelId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Initial diagnose all (background) ────────────────────
  useEffect(() => {
    if (!metamodel?.content || constraints.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: DiagnosticsMap = {};
      for (const c of constraints) {
        if (!c.expression || !c.context) continue;
        try {
          const diags = await diagnoseOCLExpression(
            metamodelId,
            c.expression,
            c.context,
            metamodel.content,
          );
          if (cancelled) return;
          updates[c.id] = (diags as any[]).map((d): OCLDiagnostic => {
            const lc = offsetToLineColumn(c.expression, d.offset);
            return {
              offset: d.offset,
              length: d.length || 1,
              message: d.message,
              severity: d.severity,
              line: lc.line,
              column: lc.column,
            };
          });
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) {
        setDiagnosticsMap((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metamodel?.content, constraints.map((c) => c.id).join(',')]);

  // ── Diagnose current expression (debounced) ──────────────
  const diagnoseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!metamodel?.content || !form.expression || !form.context) {
      // Clear current expr diagnostics if nothing to diagnose
      const targetId = isNew ? '__new__' : selectedId;
      if (targetId) {
        setDiagnosticsMap((prev) => {
          if (!prev[targetId]) return prev;
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }
      return;
    }
    if (diagnoseTimerRef.current) clearTimeout(diagnoseTimerRef.current);

    diagnoseTimerRef.current = setTimeout(async () => {
      try {
        const diags = await diagnoseOCLExpression(
          metamodelId,
          form.expression,
          form.context,
          metamodel.content,
        );
        const targetId = isNew ? '__new__' : selectedId;
        if (!targetId) return;
        const list: OCLDiagnostic[] = (diags as any[]).map((d) => {
          const lc = offsetToLineColumn(form.expression, d.offset);
          return {
            offset: d.offset,
            length: d.length || 1,
            message: d.message,
            severity: d.severity,
            line: lc.line,
            column: lc.column,
          };
        });
        setDiagnosticsMap((prev) => ({ ...prev, [targetId]: list }));
      } catch {
        /* network error — silent */
      }
    }, 400);

    return () => {
      if (diagnoseTimerRef.current) clearTimeout(diagnoseTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.expression, form.context, metamodel?.content, metamodelId, selectedId, isNew]);

  // ── Editor API for jump-to-offset ────────────────────────
  const editorAPIRef = useRef<{ revealOffset: (offset: number) => void } | null>(null);
  const registerEditorAPI = useCallback((api: { revealOffset: (offset: number) => void }) => {
    editorAPIRef.current = api;
  }, []);

  // ── Selection handlers ───────────────────────────────────
  const selectConstraint = useCallback(
    (id: string) => {
      const c = constraints.find((x) => x.id === id);
      if (!c) return;
      setSelectedId(id);
      setIsNew(false);
      setForm({
        name: c.name,
        context: c.context,
        expression: c.expression,
        severity: c.severity,
      });
      try {
        localStorage.setItem(`ocl-ide.last:${metamodelId}`, id);
      } catch {
        /* noop */
      }
    },
    [constraints, metamodelId],
  );

  const handleNew = useCallback(
    (contextClass?: string) => {
      setIsNew(true);
      setSelectedId(null);
      setForm({
        ...EMPTY_FORM,
        context: contextClass || eclassNames[0] || '',
      });
    },
    [eclassNames],
  );

  // ── Save / delete ────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!metamodelId || !form.name || !form.context || !form.expression) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await createOCLConstraint(metamodelId, {
          name: form.name,
          context: form.context,
          expression: form.expression,
          severity: form.severity,
        });
        const list = await getOCLConstraints(metamodelId);
        setConstraints(list);
        setIsNew(false);
        setSelectedId(created.id);
        setLastSaved(new Date().toISOString());
        try {
          localStorage.setItem(`ocl-ide.last:${metamodelId}`, created.id);
        } catch {
          /* noop */
        }
      } else if (selectedId) {
        await updateOCLConstraint(metamodelId, selectedId, {
          name: form.name,
          context: form.context,
          expression: form.expression,
          severity: form.severity,
        });
        const list = await getOCLConstraints(metamodelId);
        setConstraints(list);
        setLastSaved(new Date().toISOString());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [metamodelId, isNew, selectedId, form]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!metamodelId) return;
      if (!window.confirm('Delete this constraint?')) return;
      try {
        await deleteOCLConstraint(metamodelId, id);
        const list = constraints.filter((c) => c.id !== id);
        setConstraints(list);
        setDiagnosticsMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setRunSummaries((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (selectedId === id) {
          const next = list[0];
          if (next) selectConstraint(next.id);
          else {
            setSelectedId(null);
            setForm(EMPTY_FORM);
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to delete');
      }
    },
    [constraints, metamodelId, selectedId, selectConstraint],
  );

  const handleRename = useCallback(
    (c: OCLConstraint) => {
      // For now, focus the constraint in the inspector (Properties tab)
      selectConstraint(c.id);
    },
    [selectConstraint],
  );

  // ── Validation ───────────────────────────────────────────
  const handleValidateAll = useCallback(async () => {
    if (!metamodelId) return;
    setValidating(true);
    setValidationResults(null);
    try {
      const sel = models.find((m) => m.id === selectedModelId);
      const modelContent = sel?.content
        ? JSON.stringify(sel.content)
        : JSON.stringify(metamodel?.content || {});
      const res = await validateOCLConstraints(metamodelId, modelContent);
      setValidationResults(res);
      const summaries: RunSummaries = {};
      for (const r of res) summaries[r.constraintId] = runStatusFromResult(r);
      setRunSummaries(summaries);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }, [metamodelId, models, selectedModelId, metamodel]);

  const handleValidateExpression = useCallback(async () => {
    // Force a synchronous diagnose right now
    if (!metamodel?.content || !form.expression || !form.context) return;
    try {
      const diags = await diagnoseOCLExpression(
        metamodelId,
        form.expression,
        form.context,
        metamodel.content,
      );
      const targetId = isNew ? '__new__' : selectedId || '__new__';
      const list: OCLDiagnostic[] = (diags as any[]).map((d) => {
        const lc = offsetToLineColumn(form.expression, d.offset);
        return {
          offset: d.offset,
          length: d.length || 1,
          message: d.message,
          severity: d.severity,
          line: lc.line,
          column: lc.column,
        };
      });
      setDiagnosticsMap((prev) => ({ ...prev, [targetId]: list }));
      setProblemsVisible(true);
    } catch {
      /* noop */
    }
  }, [metamodel, form, metamodelId, isNew, selectedId]);

  // ── Format (placeholder) ─────────────────────────────────
  const handleFormat = useCallback(() => {
    // Minimal formatter: trim trailing spaces, normalize whitespace
    const formatted = form.expression
      .split('\n')
      .map((l) => l.replace(/[ \t]+$/, ''))
      .join('\n');
    if (formatted !== form.expression) {
      setForm((f) => ({ ...f, expression: formatted }));
    }
  }, [form.expression]);

  // ── Form change ──────────────────────────────────────────
  const updateForm = useCallback((patch: Partial<ConstraintFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  // ── Jump to problem ──────────────────────────────────────
  const handleJumpTo = useCallback(
    (constraintId: string, offset: number) => {
      if (constraintId === '__new__') {
        editorAPIRef.current?.revealOffset(offset);
        return;
      }
      if (constraintId !== selectedId) {
        selectConstraint(constraintId);
        // Defer jump until after editor swaps content
        setTimeout(() => editorAPIRef.current?.revealOffset(offset), 80);
      } else {
        editorAPIRef.current?.revealOffset(offset);
      }
    },
    [selectedId, selectConstraint],
  );

  // ── Validation status ────────────────────────────────────
  const validationStatus: 'valid' | 'invalid' | 'unknown' = useMemo(() => {
    const targetId = isNew ? '__new__' : selectedId;
    if (!targetId) return 'unknown';
    const diags = diagnosticsMap[targetId];
    if (!diags) return 'unknown';
    if (diags.some((d) => d.severity === 'error')) return 'invalid';
    return 'valid';
  }, [isNew, selectedId, diagnosticsMap]);

  // ── Monaco language registration (one-time per metamodel) ─
  const monacoLangRegisteredRef = useRef(false);
  const monacoProvidersRef = useRef<{
    setContextClass: (cn: string) => void;
    disposables: any[];
  } | null>(null);
  // Register providers once Monaco is loaded. We rely on @monaco-editor/loader to access the global instance.
  useEffect(() => {
    if (monacoLangRegisteredRef.current) return;
    if (!metamodel?.content) return;
    monacoLangRegisteredRef.current = true;
    (async () => {
      const monacoMod = await import('monaco-editor');
      const monaco = (monacoMod as any).default || monacoMod;
      const { registerOCLProviders, getOCLMonarchTokens } = await import(
        '../ocl/oclMonacoAdapter'
      );

      // Register language if not present
      const existing = monaco.languages.getLanguages();
      if (!existing.find((l: any) => l.id === 'emf-ocl')) {
        monaco.languages.register({ id: 'emf-ocl' });
      }
      monaco.languages.setMonarchTokensProvider('emf-ocl', getOCLMonarchTokens());
      const providers = registerOCLProviders(monaco, metamodel.content, form.context || '');
      monacoProvidersRef.current = providers;
    })();
    return () => {
      const p = monacoProvidersRef.current;
      if (p) {
        for (const d of p.disposables) {
          try {
            d.dispose();
          } catch {
            /* noop */
          }
        }
        monacoProvidersRef.current = null;
      }
      monacoLangRegisteredRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metamodel?.content]);

  // Sync context class with providers
  useEffect(() => {
    monacoProvidersRef.current?.setContextClass(form.context || '');
  }, [form.context]);

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 24,
          gap: 12,
        }}
      >
        <div className="skeleton" style={{ height: 32, width: 240 }} />
        <div className="skeleton" style={{ flex: 1, borderRadius: 'var(--radius-sm)' }} />
      </div>
    );
  }

  const showInspectorContextClass = form.context;
  const selectedModelName = models.find((m) => m.id === selectedModelId)?.name ?? null;
  const fullDiagnosticsMap = diagnosticsMap;
  // Effective constraints list passed to problems/browser (filter out the synthetic __new__ key from problems)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg)',
        color: 'var(--text)',
        overflow: 'hidden',
      }}
    >
      {/* Optional back-link header for standalone route */}
      {!props.projectId && projectId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <Link
            to={`/projects/${projectId}`}
            className="back-link"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            ← Back to project
          </Link>
        </div>
      )}

      <OCLToolbar
        metamodelName={metamodel?.name || ''}
        contextClass={form.context}
        dirty={dirty}
        saving={saving}
        validating={validating}
        canSave={!!form.name && !!form.context && !!form.expression}
        onNew={() => handleNew()}
        onSave={handleSave}
        onFormat={handleFormat}
        onValidateExpression={handleValidateExpression}
        onValidateAll={handleValidateAll}
      />

      {error && (
        <div style={{ padding: 8 }}>
          <ErrorPanel title="Error" message={error} compact />
        </div>
      )}

      {/* Body: 3-pane + bottom dock */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <ResizablePanel
          direction="right"
          defaultWidth={240}
          minWidth={180}
          maxWidth={400}
          storageKey="ocl-ide.left.width"
          style={{ height: '100%' }}
        >
          <OCLConstraintBrowser
            constraints={constraints}
            eclassNames={eclassNames}
            selectedId={selectedId}
            diagnosticsMap={fullDiagnosticsMap}
            runSummaries={runSummaries}
            dirtyId={dirty && selectedId ? selectedId : null}
            onSelect={selectConstraint}
            onNew={handleNew}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </ResizablePanel>

        {/* Center column: editor + problems */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {!selectedId && !isNew ? (
            <WelcomeState onNew={() => handleNew()} />
          ) : (
            <OCLEditorPane
              value={form.expression}
              language="emf-ocl"
              theme={theme}
              metamodelContent={metamodel?.content}
              contextClass={form.context}
              diagnostics={fullDiagnosticsMap[selectedId || '__new__'] || []}
              onChange={(val) => updateForm({ expression: val })}
              onCursorChange={setCursor}
              onSave={handleSave}
              onValidateAll={handleValidateAll}
              onFormat={handleFormat}
              onNew={() => handleNew()}
              registerEditorAPI={registerEditorAPI}
            />
          )}

          {problemsVisible && (
            <ResizablePanelV
              direction="top"
              defaultHeight={200}
              minHeight={120}
              maxHeight={500}
              storageKey="ocl-ide.problems.height"
              style={{ width: '100%' }}
            >
              <OCLProblemsPanel
                constraints={constraints}
                diagnosticsMap={fullDiagnosticsMap}
                validationResults={validationResults}
                onJumpTo={handleJumpTo}
                onClose={() => setProblemsVisible(false)}
              />
            </ResizablePanelV>
          )}
        </div>

        <ResizablePanel
          direction="left"
          defaultWidth={320}
          minWidth={240}
          maxWidth={440}
          storageKey="ocl-ide.right.width"
          style={{ height: '100%' }}
        >
          <OCLInspector
            form={form}
            eclassNames={eclassNames}
            metamodelContent={metamodel?.content || {}}
            contextClass={showInspectorContextClass}
            models={models}
            selectedModelId={selectedModelId}
            onChange={updateForm}
            onSelectModel={setSelectedModelId}
          />
        </ResizablePanel>
      </div>

      <OCLStatusBar
        cursor={cursor}
        contextClass={form.context}
        diagnosticsMap={
          selectedId
            ? { [selectedId]: fullDiagnosticsMap[selectedId] || [] }
            : isNew
              ? { __new__: fullDiagnosticsMap['__new__'] || [] }
              : {}
        }
        selectedModelName={selectedModelName}
        saving={saving}
        dirty={dirty}
        lastSaved={lastSaved}
        validationStatus={validationStatus}
      />
    </div>
  );
}

function WelcomeState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--text-muted)',
        background: 'var(--bg)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
        OCL Editor
      </div>
      <div style={{ fontSize: 12 }}>Select a constraint or create a new one to start.</div>
      <button
        onClick={onNew}
        style={{
          marginTop: 12,
          padding: '8px 14px',
          borderRadius: 6,
          border: '1px solid var(--primary)',
          background: 'var(--primary-bg)',
          color: 'var(--primary-light)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        + New constraint
      </button>
    </div>
  );
}
