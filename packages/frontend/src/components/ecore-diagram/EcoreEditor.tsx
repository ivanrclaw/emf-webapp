/**
 * @emf-webapp/frontend — EcoreEditor
 *
 * Editor visual de metamodelos EMF con React Flow.
 * Layout: Toolbox (izquierda) → Canvas (centro) → Inspector (derecha)
 * Barra superior con controles de save/delete/export/validación.
 *
 * Arquitectura:
 *   - useEcoreModel hook maneja todo el estado bidireccional
 *   - Drag & Drop desde Toolbox al canvas
 *   - Auto-save con indicador dirty
 *   - Atajos de teclado (Del, Ctrl+S)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  Panel,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import { useParams, Link } from 'react-router-dom';
import '@xyflow/react/dist/style.css';

import { useEcoreModel } from './useEcoreModel';
import { nodeTypes } from './nodes/nodeTypes';
import { edgeTypes } from './edges/CustomEdges';
import { getMetamodel, getProject } from '../../api/client';

import type {
  SerializableEPackage,
  AppNode,
  EcoreNodeData,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
} from './types';

// ── Type guards ──────────────────────────────────────────────────
function isClass(c: any): c is SerializableEClass {
  return c && 'eAttributes' in c;
}
function isEnum(c: any): c is SerializableEEnum {
  return c && 'eLiterals' in c && !('eAttributes' in c);
}
function isDataType(c: any): c is SerializableEDataType {
  return c && !('eAttributes' in c) && !('eLiterals' in c);
}

// ── Panel components ───────────────────────────────────────────
import { Toolbox, DRAG_DATA_KEY } from './Toolbox';
import { PropertyInspector } from './PropertyInspector';
import { TreeView } from './TreeView';

// ═══════════════════════════════════════════════════════════════
// Styles (inline — kept co-located for the editor layout)
// ═══════════════════════════════════════════════════════════════

const styles = {
  wrapper: { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' as const, background: 'var(--bg)' },
  // Top bar
  topbar: {
    display: 'flex', alignItems: 'center' as const, justifyContent: 'space-between' as const,
    padding: '0 20px', height: 52, background: 'var(--surface)',
    borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 10,
  },
  topbarLeft: { display: 'flex', alignItems: 'center' as const, gap: 12 },
  topbarRight: { display: 'flex', alignItems: 'center' as const, gap: 8 },
  logo: {
    fontWeight: 800, fontSize: 16, color: 'var(--primary)',
    letterSpacing: '-0.5px', padding: '4px 0',
  },
  logoSub: { color: 'var(--text-secondary)', fontWeight: 400, fontSize: 13 },
  badge: {
    display: 'inline-flex', alignItems: 'center' as const,
    padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
    letterSpacing: '0.3px',
  },
  btn: {
    display: 'inline-flex', alignItems: 'center' as const, gap: 5,
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  btnPrimary: {
    background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)',
  },
  btnDanger: {
    background: 'var(--danger-bg)', color: 'var(--danger)', border: `1px solid var(--danger)`,
  },
  btnIcon: { width: 34, height: 34, padding: 0, display: 'flex', alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, transition: 'all 0.15s' },
  // Body layout
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  // Left sidebar
  sidebar: {
    width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column' as const, background: 'var(--surface)',
  },
  // Canvas area
  canvasArea: { flex: 1, position: 'relative' as const },
  // Right sidebar
  inspector: {
    width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column' as const, background: 'var(--surface)',
  },
  // Loading / Error overlays
  center: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    height: '100%', gap: 12, padding: 40,
    textAlign: 'center' as const,
  },
  errorBox: {
    background: 'var(--danger-bg)', border: '1px solid var(--danger)',
    borderRadius: 12, padding: '24px 32px',
    maxWidth: 500, color: 'var(--danger)',
  },
};

// ═══════════════════════════════════════════════════════════════
// Inner component (needs ReactFlowProvider context)
// ═══════════════════════════════════════════════════════════════

interface EditorInnerProps {
  projectId: string;
  metamodelId: string;
}

function EditorInner({ projectId, metamodelId }: EditorInnerProps) {
  const reactFlowInstance = useReactFlow();
  const [fetchedPkg, setFetchedPkg] = useState<SerializableEPackage | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const initialLoad = useRef(true);

  // ── Fetch metamodel + project name on mount ─────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [mm, proj] = await Promise.all([
          getMetamodel(projectId, metamodelId),
          getProject(projectId),
        ]);
        if (cancelled) return;
        setProjectName(proj.name);
        const content = mm.content as any;
        if (content && typeof content === 'object' && content.name) {
          const pkg: SerializableEPackage = {
            name: content.name || 'model',
            nsURI: content.nsURI || mm.nsUri || '',
            nsPrefix: content.nsPrefix || mm.nsPrefix || '',
            eClassifiers: Array.isArray(content.eClassifiers) ? content.eClassifiers : [],
          };
          setFetchedPkg(pkg);
        } else {
          // New/empty metamodel
          setFetchedPkg({
            name: mm.name || 'model',
            nsURI: mm.nsUri || '',
            nsPrefix: mm.nsPrefix || '',
            eClassifiers: [],
          });
        }
      } catch (err: any) {
        if (!cancelled) setFetchError(err.message || 'Failed to load metamodel');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, metamodelId]);

  const model = useEcoreModel({
    projectId,
    metamodelId,
    initialPkg: fetchedPkg,
  });

  // Track initial load complete
  if (fetchedPkg && initialLoad.current) {
    initialLoad.current = false;
  }

  // ── Helper function for inspector (MUST be before early returns!) ──
  const handleAddAttribute = useCallback(
    (classId: string) => model.addAttribute(classId),
    [model],
  );

  const handleAddReference = useCallback(
    (classId: string) => model.addReference(classId),
    [model],
  );

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        if (model.selectedId) {
          model.deleteSelected();
          e.preventDefault();
        }
      }
      // Ctrl+S → save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        model.save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [model]);

  // ── Node/Edge click handlers ────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback(
    (_: any, node: Node) => {
      const data = node.data as EcoreNodeData;
      const typeMap: Record<string, string> = { ecoreClass: 'class', ecoreEnum: 'enum', ecoreDataType: 'dataType' };
      model.setSelected(node.id, typeMap[data?.type] ?? 'class');
    },
    [model],
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_: any, edge: Edge) => {
      model.setSelected(edge.id, 'edge');
    },
    [model],
  );

  const onPaneClick = useCallback(() => {
    model.setSelected(null, null);
  }, [model]);

  // ── Drag & Drop from Toolbox ────────────────────────────────
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(DRAG_DATA_KEY) as 'class' | 'enum' | 'dataType' | null;
      if (!type) return;
      if (!reactFlowInstance) return;

      const bounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
      if (!bounds) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      model.onDropNode(type, position);
    },
    [reactFlowInstance, model],
  );

  // ── Loading state ───────────────────────────────────────────
  if (!fetchedPkg && !fetchError) {
    return (
      <div style={styles.center}>
        <div className="spinner" style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading metamodel…</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────
  if (fetchError) {
    return (
      <div style={styles.center}>
        <div style={styles.errorBox}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Failed to load metamodel</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{fetchError}</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div style={styles.topbar}>
        <div style={styles.topbarLeft}>
          {/* Back to project */}
          <Link
            to={`/projects/${projectId}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 8, textDecoration: 'none',
              fontSize: 13, fontWeight: 500,
              color: 'var(--text-secondary)',
              transition: 'all .15s',
              marginRight: 8,
            }}
            title="Back to project"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </Link>

          {/* Breadcrumb-style separator */}
          <span style={{ color: 'var(--border)', fontSize: 14, fontWeight: 300, marginRight: 8 }}>/</span>

          {/* Project name */}
          <Link
            to={`/projects/${projectId}`}
            style={{
              fontSize: 14, fontWeight: 500, textDecoration: 'none',
              color: 'var(--text-secondary)',
              transition: 'color .15s',
            }}
          >
            {projectName || 'Project'}
          </Link>

          <span style={{ color: 'var(--border)', fontSize: 14, fontWeight: 300, margin: '0 8px' }}>/</span>

          {/* Current metamodel name */}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {model.pkg.name || 'Untitled'}
          </span>

          {/* Dirty indicator */}
          {model.isDirty && (
            <span style={{ ...styles.badge, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 11 }}>
              ● Modified
            </span>
          )}
        </div>

        <div style={styles.topbarRight}>
          {/* Validation status */}
          <span
            style={{
              ...styles.badge,
              background: 'var(--success-bg)', color: 'var(--success)',
              fontSize: 12, gap: 4, display: 'inline-flex', alignItems: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            Valid
          </span>

          {/* Dirty status pill */}
          {model.isDirty && (
            <span style={{ ...styles.badge, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 11 }}>
              Unsaved
            </span>
          )}

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          {/* Save button */}
          <button
            style={{
              ...styles.btn,
              ...styles.btnPrimary,
              opacity: model.loading ? 0.7 : 1,
              cursor: model.loading ? 'not-allowed' : 'pointer',
            }}
            onClick={model.save}
            disabled={model.loading}
          >
            {model.loading ? (
              <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
            )}
            {model.loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div style={styles.body}>
        {/* ── Left Sidebar ──────────────────────────────────── */}
        <div style={styles.sidebar}>
          <Toolbox onAdd={model.addClassifier} />
          <div style={{ flex: 1, overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
            <TreeView
              pkg={model.pkg}
              onSelect={(id) => {
                if (!id) { model.setSelected(null, null); return; }
                // Check classifiers first
                const c = model.pkg.eClassifiers.find((x) => x.id === id);
                if (c) {
                  const type = isClass(c) ? 'class' : isEnum(c) ? 'enum' : 'dataType';
                  model.setSelected(id, type);
                  return;
                }
                // Check features (attributes/references)
                for (const cls of model.pkg.eClassifiers) {
                  if (!isClass(cls)) continue;
                  if (cls.eAttributes.some((a) => a.id === id)) {
                    model.setSelected(id, 'attribute');
                    return;
                  }
                  if (cls.eReferences.some((r) => r.id === id)) {
                    model.setSelected(id, 'reference');
                    return;
                  }
                }
                model.setSelected(id, null);
              }}
              selectedId={model.selectedId}
            />
          </div>
        </div>

        {/* ── Canvas ─────────────────────────────────────────── */}
        <div style={styles.canvasArea}>
          <ReactFlow
            nodes={model.nodes as any}
            edges={model.edges as any}
            onNodesChange={model.onNodesChange}
            onEdgesChange={model.onEdgesChange}
            onConnect={model.onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes as any}
            edgeTypes={edgeTypes as any}
            fitView
            selectionMode={SelectionMode.Partial}
            deleteKeyCode={['Delete', 'Backspace']}
            multiSelectionKeyCode="Shift"
            panOnScroll
            minZoom={0.1}
            maxZoom={4}
            defaultEdgeOptions={{
              animated: false,
              style: { stroke: '#94a3b8', strokeWidth: 2 },
            }}
            style={{ background: 'var(--bg)' }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--border)"
            />
            <Controls
              style={{
                borderRadius: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
              showInteractive={false}
            />
            <MiniMap
              style={{
                borderRadius: 10,
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              nodeColor={(n: any) => {
                switch (n.type) {
                  case 'eClassNode': return '#6366f1';
                  case 'eEnumNode': return '#f97316';
                  case 'eDataTypeNode': return '#6b7280';
                  default: return '#94a3b8';
                }
              }}
              maskColor="rgba(15,23,42,0.7)"
              pannable
              zoomable
            />

            {/* Status bar */}
            <Panel position="bottom-left">
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '6px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  fontSize: 12, color: 'var(--text-secondary)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <span>{model.nodes?.length ?? 0} nodes</span>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span>{model.edges?.length ?? 0} edges</span>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span>{model.pkg.nsPrefix || 'no nsPrefix'}</span>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* ── Right Sidebar ─────────────────────────────────── */}
        <div style={styles.inspector}>
          <PropertyInspector
            selectedId={model.selectedId}
            selectedType={model.selectedType as any}
            pkg={model.pkg}
            onClassifierChange={model.handleClassifierChange}
            onAddAttribute={handleAddAttribute}
            onAddReference={handleAddReference}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Wrapper with ReactFlowProvider
// ═══════════════════════════════════════════════════════════════

export interface EcoreEditorProps {
  projectId: string;
  metamodelId: string;
}

export function EcoreEditor(_props: EcoreEditorProps) {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();
  const projectId = pid ?? '';
  const metamodelId = mmid ?? '';
  // Reset component on route change
  const key = `${projectId}/${metamodelId}`;

  return (
    <ReactFlowProvider key={key}>
      <EditorInner projectId={projectId} metamodelId={metamodelId} />
    </ReactFlowProvider>
  );
}

export default EcoreEditor;
