/**
 * @emf-webapp/frontend — SpecEditor v2 (Master-Detail Layout)
 *
 * Graphical Syntax Editor with:
 * - Left: MappingNavigator (hierarchical tree of all mappings)
 * - Center: MappingDetailPanel (form-based editor for selected mapping)
 * - Right: MappingPreview (live mini-canvas preview)
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  getMetamodel,
  getGraphicalSpecs,
  createGraphicalSpec,
  updateGraphicalSpec,
  type Metamodel,
  type GraphicalSpec,
} from '../api/client';
import { MappingNavigator, type MappingSelection } from '../components/spec-editor/MappingNavigator';
import { MappingDetailPanel } from '../components/spec-editor/MappingDetailPanel';
import { MappingPreview } from '../components/spec-editor/MappingPreview';
import type {
  ViewpointSpec,
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
  ToolSection,
} from '../components/spec-diagram/types';
import {
  createDefaultViewpointSpec,
  createDefaultNodeStyle,
  createDefaultEdgeStyle,
  createDefaultLayer,
} from '../components/spec-diagram/types';
import { generateViewpointSpec, type MetamodelInput } from '../lib/spec-generator';
import { useSpecHistory } from '../components/spec-editor/hooks/useSpecHistory';
import { validateSpec, type ValidationIssue } from '../components/spec-editor/hooks/useSpecValidation';
import { STYLE_TEMPLATES, applyTemplate } from '../components/spec-editor/hooks/styleTemplates';
import { Save, Wand2, Undo2, Redo2, Download, Upload, Copy, Palette, AlertTriangle, ChevronRight } from '../components/icons';
import ErrorPanel from '../components/feedback/ErrorPanel';
import { useRoomPresence } from '../hooks/useRoomPresence';
import { CollaborationBar } from '../components/collaboration/CollaborationBar';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/*  SpecEditorInner                                                    */
/* ------------------------------------------------------------------ */

function SpecEditorInner({ projectId: propPid, metamodelId: propMmid }: { projectId?: string; metamodelId?: string }) {
  const { pid, mmid, specId } = useParams<{ pid: string; mmid: string; specId?: string }>();
  const projectId = propPid || pid || '';
  const metamodelId = propMmid || mmid || '';

  // ─── Collaboration Presence ─────────────────────────────────────
  const presence = useRoomPresence({ roomId: `spec-${metamodelId}` });

  // ─── State ───────────────────────────────────────────────────────
  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [activeSpec, setActiveSpec] = useState<GraphicalSpec | null>(null);
  const [spec, setSpec] = useState<ViewpointSpec | null>(null);
  const [activeLayerId, setActiveLayerId] = useState('layer_default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | ''>('');

  // Selection
  const [selection, setSelection] = useState<MappingSelection | null>(null);

  // Sync selection to presence
  useEffect(() => {
    presence.setActiveElement(selection?.id ?? null);
  }, [selection, presence]);

  // History (undo/redo)
  const history = useSpecHistory(null);

  // Validation
  const validationIssues = useMemo(() => {
    if (!spec) return [];
    return validateSpec(spec);
  }, [spec]);

  // Template menu
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  // Clipboard for copy style
  const copiedStyleRef = useRef<{ type: 'node' | 'edge'; style: any } | null>(null);

  const lastSavedRef = useRef('');

  // ─── Derived data ────────────────────────────────────────────────
  const eclasses = useMemo(() => {
    if (!metamodel?.content?.eClassifiers) return [];
    return metamodel.content.eClassifiers as Array<{
      name: string;
      abstract?: boolean;
      interface?: boolean;
      eAttributes?: any[];
      eReferences?: any[];
    }>;
  }, [metamodel]);

  const activeLayer = useMemo(() => {
    if (!spec) return null;
    if (spec.defaultLayer.id === activeLayerId) return spec.defaultLayer;
    return spec.additionalLayers.find((l) => l.id === activeLayerId) || spec.defaultLayer;
  }, [spec, activeLayerId]);

  const allLayers = useMemo(() => {
    if (!spec) return [];
    return [spec.defaultLayer, ...spec.additionalLayers];
  }, [spec]);

  // ─── Load ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!metamodelId) return;
      setLoading(true);
      try {
        const [mm, specs] = await Promise.all([
          getMetamodel(projectId, metamodelId),
          getGraphicalSpecs(metamodelId),
        ]);
        setMetamodel(mm);

        if (specId && specs.length > 0) {
          const found = specs.find((s) => s.id === specId) || specs[0];
          setActiveSpec(found);
          const parsed = JSON.parse(found.spec || '{}') as ViewpointSpec;
          setSpec(parsed);
          history.reset(parsed);
        } else if (specs.length > 0) {
          setActiveSpec(specs[0]);
          const parsed = JSON.parse(specs[0].spec || '{}') as ViewpointSpec;
          setSpec(parsed);
          history.reset(parsed);
        } else {
          const empty = createDefaultViewpointSpec(metamodelId);
          setSpec(empty);
          history.reset(empty);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [metamodelId, specId, projectId]);

  // ─── Save ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!metamodelId || !spec) return;
    setSaving(true);
    try {
      const payload = JSON.stringify(spec);
      if (activeSpec) {
        await updateGraphicalSpec(metamodelId, activeSpec.id, { spec: payload });
      } else {
        const created = await createGraphicalSpec(metamodelId, {
          name: spec.name || 'Viewpoint Spec',
          spec: payload,
        });
        setActiveSpec(created);
      }
      lastSavedRef.current = payload;
      setSaveStatus('saved');
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [metamodelId, activeSpec, spec]);

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!spec) return;
      const current = JSON.stringify(spec);
      if (current !== lastSavedRef.current) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [handleSave, spec]);

  // ─── Auto-generate spec from metamodel ───────────────────────────
  const handleAutoGenerate = useCallback(() => {
    if (!metamodel?.content) return;
    const input: MetamodelInput = {
      name: metamodel.content.name || metamodel.name || 'Model',
      nsURI: metamodel.content.nsURI,
      eClassifiers: (metamodel.content.eClassifiers || []) as any[],
    };
    const generated = generateViewpointSpec(input, metamodelId);
    setSpec(generated);
    setActiveLayerId(generated.defaultLayer.id);
    setSaveStatus('unsaved');
    setSelection(null);
  }, [metamodel, metamodelId]);

  // ─── Spec mutation helpers ───────────────────────────────────────
  const updateSpec = useCallback((updater: (prev: ViewpointSpec) => ViewpointSpec) => {
    setSpec((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setSaveStatus('unsaved');
      history.push(next);
      return next;
    });
  }, [history]);

  const updateActiveLayer = useCallback((updater: (layer: Layer) => Layer) => {
    updateSpec((prev) => {
      if (prev.defaultLayer.id === activeLayerId) {
        return { ...prev, defaultLayer: updater(prev.defaultLayer) };
      }
      return {
        ...prev,
        additionalLayers: prev.additionalLayers.map((l) =>
          l.id === activeLayerId ? updater(l) : l,
        ),
      };
    });
  }, [activeLayerId, updateSpec]);

  // ─── Add node mapping ────────────────────────────────────────────
  const handleAddNodeMapping = useCallback((className: string) => {
    const newMapping: NodeMapping = {
      id: `nm_${uid()}`,
      domainClass: className,
      semanticCandidatesExpression: 'self',
      labelExpression: 'self.name',
      defaultStyle: createDefaultNodeStyle(),
      conditionalStyles: [],
    };
    updateActiveLayer((layer) => ({
      ...layer,
      nodeMappings: [...layer.nodeMappings, newMapping],
    }));
    // Auto-select the new mapping
    setSelection({ type: 'node', id: newMapping.id });
  }, [updateActiveLayer]);

  // ─── Add container mapping ──────────────────────────────────────
  const handleAddContainerMapping = useCallback((className: string) => {
    const newMapping: ContainerMapping = {
      id: `cm_${uid()}`,
      domainClass: className,
      semanticCandidatesExpression: 'self',
      labelExpression: 'self.name',
      defaultStyle: createDefaultNodeStyle(),
      conditionalStyles: [],
      childrenPresentation: 'FreeForm',
      subNodeMappingIds: [],
      subContainerMappingIds: [],
    };
    updateActiveLayer((layer) => ({
      ...layer,
      containerMappings: [...layer.containerMappings, newMapping],
    }));
    setSelection({ type: 'container', id: newMapping.id });
  }, [updateActiveLayer]);

  // ─── Add edge mapping ────────────────────────────────────────────
  const handleAddEdgeMapping = useCallback((sourceClass: string, refName: string, targetClass: string) => {
    if (!activeLayer) return;
    const sourceMappingIds = [
      ...activeLayer.nodeMappings.filter((m) => m.domainClass === sourceClass).map((m) => m.id),
      ...activeLayer.containerMappings.filter((m) => m.domainClass === sourceClass).map((m) => m.id),
    ];
    const targetMappingIds = [
      ...activeLayer.nodeMappings.filter((m) => m.domainClass === targetClass).map((m) => m.id),
      ...activeLayer.containerMappings.filter((m) => m.domainClass === targetClass).map((m) => m.id),
    ];

    const newEdge: EdgeMapping = {
      id: `em_${uid()}`,
      type: 'relation-based',
      sourceReference: refName,
      sourceMappingIds,
      targetMappingIds,
      targetFinderExpression: `self.${refName}`,
      defaultStyle: createDefaultEdgeStyle(),
      conditionalStyles: [],
    };
    updateActiveLayer((layer) => ({
      ...layer,
      edgeMappings: [...layer.edgeMappings, newEdge],
    }));
    setSelection({ type: 'edge', id: newEdge.id });
  }, [activeLayer, updateActiveLayer]);

  // ─── Delete mapping ──────────────────────────────────────────────
  const handleDeleteMapping = useCallback((type: string, id: string) => {
    updateActiveLayer((layer) => {
      switch (type) {
        case 'node':
          return { ...layer, nodeMappings: layer.nodeMappings.filter((m) => m.id !== id) };
        case 'container':
          return { ...layer, containerMappings: layer.containerMappings.filter((m) => m.id !== id) };
        case 'edge':
          return { ...layer, edgeMappings: layer.edgeMappings.filter((m) => m.id !== id) };
        default:
          return layer;
      }
    });
    if (selection?.id === id) setSelection(null);
  }, [updateActiveLayer, selection]);

  // ─── Duplicate mapping ───────────────────────────────────────────
  const handleDuplicateMapping = useCallback((type: string, id: string) => {
    updateActiveLayer((layer) => {
      switch (type) {
        case 'node': {
          const orig = layer.nodeMappings.find((m) => m.id === id);
          if (!orig) return layer;
          const dup = { ...orig, id: `nm_${uid()}`, domainClass: `${orig.domainClass}_copy` };
          return { ...layer, nodeMappings: [...layer.nodeMappings, dup] };
        }
        case 'container': {
          const orig = layer.containerMappings.find((m) => m.id === id);
          if (!orig) return layer;
          const dup = { ...orig, id: `cm_${uid()}`, domainClass: `${orig.domainClass}_copy` };
          return { ...layer, containerMappings: [...layer.containerMappings, dup] };
        }
        case 'edge': {
          const orig = layer.edgeMappings.find((m) => m.id === id);
          if (!orig) return layer;
          const dup = { ...orig, id: `em_${uid()}` };
          return { ...layer, edgeMappings: [...layer.edgeMappings, dup] };
        }
        default:
          return layer;
      }
    });
  }, [updateActiveLayer]);

  // ─── Update mappings from detail panel ───────────────────────────
  const handleUpdateNodeMapping = useCallback((id: string, patch: Partial<NodeMapping>) => {
    updateActiveLayer((layer) => ({
      ...layer,
      nodeMappings: layer.nodeMappings.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));
  }, [updateActiveLayer]);

  const handleUpdateContainerMapping = useCallback((id: string, patch: Partial<ContainerMapping>) => {
    updateActiveLayer((layer) => ({
      ...layer,
      containerMappings: layer.containerMappings.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));
  }, [updateActiveLayer]);

  const handleUpdateEdgeMapping = useCallback((id: string, patch: Partial<EdgeMapping>) => {
    updateActiveLayer((layer) => ({
      ...layer,
      edgeMappings: layer.edgeMappings.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));
  }, [updateActiveLayer]);

  const handleUpdateToolSections = useCallback((sections: ToolSection[]) => {
    updateActiveLayer((layer) => ({ ...layer, toolSections: sections }));
  }, [updateActiveLayer]);

  // ─── Undo/Redo ──────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      setSpec(prev);
      setSaveStatus('unsaved');
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) {
      setSpec(next);
      setSaveStatus('unsaved');
    }
  }, [history]);

  // ─── Import/Export ──────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!spec) return;
    const json = JSON.stringify(spec, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.name || 'viewpoint-spec'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [spec]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result as string) as ViewpointSpec;
          if (imported.defaultLayer && imported.diagram) {
            setSpec(imported);
            history.reset(imported);
            setActiveLayerId(imported.defaultLayer.id);
            setSaveStatus('unsaved');
            setSelection(null);
          } else {
            setError('Invalid spec file: missing required fields');
          }
        } catch {
          setError('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [history]);

  // ─── Copy/Paste Style ───────────────────────────────────────────
  const handleCopyStyle = useCallback(() => {
    if (!selection || !activeLayer) return;
    if (selection.type === 'node' || selection.type === 'container') {
      const mapping = activeLayer.nodeMappings.find((m) => m.id === selection.id)
        || activeLayer.containerMappings.find((m) => m.id === selection.id);
      if (mapping) {
        copiedStyleRef.current = { type: 'node', style: { ...mapping.defaultStyle } };
      }
    } else if (selection.type === 'edge') {
      const mapping = activeLayer.edgeMappings.find((m) => m.id === selection.id);
      if (mapping) {
        copiedStyleRef.current = { type: 'edge', style: { ...mapping.defaultStyle } };
      }
    }
  }, [selection, activeLayer]);

  const handlePasteStyle = useCallback(() => {
    if (!selection || !copiedStyleRef.current) return;
    const copied = copiedStyleRef.current;

    if ((selection.type === 'node' || selection.type === 'container') && copied.type === 'node') {
      updateActiveLayer((layer) => ({
        ...layer,
        nodeMappings: layer.nodeMappings.map((m) =>
          m.id === selection.id ? { ...m, defaultStyle: { ...copied.style } } : m
        ),
        containerMappings: layer.containerMappings.map((m) =>
          m.id === selection.id ? { ...m, defaultStyle: { ...copied.style } } : m
        ),
      }));
    } else if (selection.type === 'edge' && copied.type === 'edge') {
      updateActiveLayer((layer) => ({
        ...layer,
        edgeMappings: layer.edgeMappings.map((m) =>
          m.id === selection.id ? { ...m, defaultStyle: { ...copied.style } } : m
        ),
      }));
    }
  }, [selection, updateActiveLayer]);

  // ─── Apply Template ─────────────────────────────────────────────
  const handleApplyTemplate = useCallback((templateId: string) => {
    if (!activeLayer) return;
    const template = STYLE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const { nodePatches, edgePatches } = applyTemplate(
      template,
      [...activeLayer.nodeMappings, ...activeLayer.containerMappings],
      activeLayer.edgeMappings,
    );

    updateActiveLayer((layer) => ({
      ...layer,
      nodeMappings: layer.nodeMappings.map((nm) => {
        const patch = nodePatches.find((p) => p.id === nm.id);
        return patch ? { ...nm, defaultStyle: patch.style } : nm;
      }),
      containerMappings: layer.containerMappings.map((cm) => {
        const patch = nodePatches.find((p) => p.id === cm.id);
        return patch ? { ...cm, defaultStyle: patch.style } : cm;
      }),
      edgeMappings: layer.edgeMappings.map((em) => {
        const patch = edgePatches.find((p) => p.id === em.id);
        return patch ? { ...em, defaultStyle: patch.style } : em;
      }),
    }));
    setTemplateMenuOpen(false);
  }, [activeLayer, updateActiveLayer]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handleCopyStyle();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        handlePasteStyle();
      }
      if (e.key === 'Delete' && selection) {
        if (selection.type === 'node' || selection.type === 'container' || selection.type === 'edge') {
          handleDeleteMapping(selection.type, selection.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleUndo, handleRedo, handleCopyStyle, handlePasteStyle, handleDeleteMapping, selection]);

  // ─── Render helpers (must be before any early return) ────────────
  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const parts: string[] = [spec?.name || 'Viewpoint'];
    if (activeLayer) parts.push(activeLayer.name);
    if (selection) {
      if (selection.type === 'node') {
        const m = activeLayer?.nodeMappings.find((n) => n.id === selection.id);
        if (m) parts.push(m.domainClass);
      } else if (selection.type === 'container') {
        const m = activeLayer?.containerMappings.find((n) => n.id === selection.id);
        if (m) parts.push(m.domainClass);
      } else if (selection.type === 'edge') {
        const m = activeLayer?.edgeMappings.find((n) => n.id === selection.id);
        if (m) parts.push(m.sourceReference || m.domainClass || 'Edge');
      }
    }
    return parts;
  }, [spec, activeLayer, selection]);

  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warnCount = validationIssues.filter((i) => i.severity === 'warning').length;

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', minWidth: 0, flex: '0 1 auto' }}>
          {breadcrumb.map((part, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <ChevronRight size={10} />}
              <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text)' : undefined, fontWeight: i === 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{part}</span>
            </span>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Collaboration presence */}
        <CollaborationBar
          connected={presence.connected}
          remoteStates={presence.remoteStates}
          currentUserName={presence.userName}
          currentUserColor={presence.userColor}
        />

        {/* Validation indicator */}
        {(errorCount > 0 || warnCount > 0) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: errorCount > 0 ? 'var(--error, #ef4444)' : 'var(--warning, #f59e0b)' }} title={`${errorCount} error(s), ${warnCount} warning(s)`}>
            <AlertTriangle size={11} />
            {errorCount > 0 && <span>{errorCount}E</span>}
            {warnCount > 0 && <span>{warnCount}W</span>}
          </span>
        )}

        {/* Save status */}
        {saveStatus === 'saved' && <span style={{ color: 'var(--success)', fontSize: 10 }}>Saved</span>}
        {saveStatus === 'unsaved' && <span style={{ color: 'var(--warning)', fontSize: 10 }}>Unsaved</span>}

        {/* Undo/Redo */}
        <button className="btn btn-ghost btn-sm" onClick={handleUndo} disabled={!history.canUndo} title="Undo (Ctrl+Z)" style={{ padding: '4px 6px', opacity: history.canUndo ? 1 : 0.3 }}>
          <Undo2 size={14} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleRedo} disabled={!history.canRedo} title="Redo (Ctrl+Y)" style={{ padding: '4px 6px', opacity: history.canRedo ? 1 : 0.3 }}>
          <Redo2 size={14} />
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Copy/Paste Style */}
        <button className="btn btn-ghost btn-sm" onClick={handleCopyStyle} disabled={!selection} title="Copy Style (Ctrl+Shift+C)" style={{ padding: '4px 6px', opacity: selection ? 1 : 0.3 }}>
          <Copy size={14} />
        </button>

        {/* Templates */}
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setTemplateMenuOpen(!templateMenuOpen)} title="Apply style template" style={{ padding: '4px 6px' }}>
            <Palette size={14} />
          </button>
          {templateMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setTemplateMenuOpen(false)} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface-elevated, var(--surface))', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
                {STYLE_TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => handleApplyTemplate(t.id)} style={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 12 }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))')} onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Import/Export */}
        <button className="btn btn-ghost btn-sm" onClick={handleImport} title="Import spec from JSON" style={{ padding: '4px 6px' }}>
          <Upload size={14} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleExport} title="Export spec as JSON" style={{ padding: '4px 6px' }}>
          <Download size={14} />
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Generate & Save */}
        <button className="btn btn-secondary btn-sm" onClick={handleAutoGenerate} title="Auto-generate from metamodel">
          <Wand2 size={14} /> Generate
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : <><Save size={14} /> Save</>}
        </button>
      </div>

      {error && (
        <div style={{ padding: '6px 16px' }}>
          <ErrorPanel title="Error" message={error} compact />
        </div>
      )}

      {/* Main 3-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel — Mapping Navigator */}
        <div style={{
          width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}>
          {activeLayer && (
            <MappingNavigator
              layer={activeLayer}
              allLayers={allLayers}
              activeLayerId={activeLayerId}
              eclasses={eclasses}
              selection={selection}
              onSelect={setSelection}
              onAddNodeMapping={handleAddNodeMapping}
              onAddContainerMapping={handleAddContainerMapping}
              onAddEdgeMapping={handleAddEdgeMapping}
              onDeleteMapping={handleDeleteMapping}
              onDuplicateMapping={handleDuplicateMapping}
              onSelectLayer={setActiveLayerId}
              remotePresence={presence.remoteStates}
            />
          )}
        </div>

        {/* Center Panel — Detail Editor */}
        <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          {activeLayer && (
            <MappingDetailPanel
              selection={selection}
              layer={activeLayer}
              allLayers={allLayers}
              eclasses={eclasses}
              onUpdateNodeMapping={handleUpdateNodeMapping}
              onUpdateContainerMapping={handleUpdateContainerMapping}
              onUpdateEdgeMapping={handleUpdateEdgeMapping}
              onUpdateToolSections={handleUpdateToolSections}
              onEditingField={presence.setEditingField}
            />
          )}
        </div>

        {/* Right Panel — Live Preview */}
        <div style={{
          width: 300, background: 'var(--background)', flexShrink: 0,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {activeLayer && (
            <MappingPreview
              selection={selection}
              layer={activeLayer}
              eclasses={eclasses}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wrapper with ReactFlowProvider (needed for MappingPreview)         */
/* ------------------------------------------------------------------ */

export default function SpecEditor(props: { projectId?: string; metamodelId?: string }) {
  return (
    <ReactFlowProvider>
      <SpecEditorInner {...props} />
    </ReactFlowProvider>
  );
}
