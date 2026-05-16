/**
 * @emf-webapp/frontend — EcoreEditor
 *
 * Embeddable visual editor for EMF metamodels using React Flow.
 * Renders ONLY the canvas area; sidebars are portaled into workspace panel slots.
 *
 * Arquitectura:
 *   - useEcoreModel hook maneja todo el estado bidireccional
 *   - Drag & Drop desde Toolbox al canvas
 *   - Atajos de teclado (Del, Ctrl+S, Ctrl+Z, Ctrl+Shift+Z)
 *   - ErrorBoundary wrapping para capturar Error #310
 *   - Registers actions/state with EditorContext for workspace toolbar
 *   - Portals Toolbox+TreeView into left panel, PropertyInspector+OCL into right panel
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
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
import '@xyflow/react/dist/style.css';

import { useEcoreModel } from './useEcoreModel';
import { nodeTypes } from './nodes/nodeTypes';
import { edgeTypes } from './edges/CustomEdges';
import { getMetamodel, getProject, exportEcore, exportGenmodel, exportXmiZip } from '../../api/client';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useOCLValidation } from '../../hooks/useOCLValidation';
import { useToast } from '../ToastProvider';
import { RemoteCursors } from '../collaboration/RemoteCursors';
import type { RoomUser } from '../../hooks/useCollaboration';
import { ErrorBoundary } from '../ErrorBoundary';
import { useEditorContext } from '../../contexts/EditorContext';
import { usePanelPortals } from '../../contexts/PanelPortalContext';

import type {
  SerializableEPackage,
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
import OCLValidationPanel from './OCLValidationPanel';

// ═══════════════════════════════════════════════════════════════
// Styles (inline — kept co-located for the editor layout)
// ═══════════════════════════════════════════════════════════════

const styles = {
  canvas: { width: '100%', height: '100%', position: 'relative' as const },
  center: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    height: '100%', width: '100%', gap: 12, padding: 40,
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
  const { addToast } = useToast();

  // ── Context hooks ──────────────────────────────────────────────
  const { register, updateState, unregister } = useEditorContext();
  const { leftPanelRef, rightPanelRef, setRightPanelVisible } = usePanelPortals();

  // Force re-render once portal refs are available (refs don't trigger renders)
  const [portalsReady, setPortalsReady] = useState(false);
  useEffect(() => {
    // Check on next frame after mount when refs are assigned
    const raf = requestAnimationFrame(() => {
      if (leftPanelRef.current || rightPanelRef.current) {
        setPortalsReady(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [leftPanelRef, rightPanelRef]);

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

  // ── OCL Live Validation (MUST be before useEcoreModel) ─────
  const classifierInfo = useMemo(() => {
    if (!fetchedPkg) return [];
    return fetchedPkg.eClassifiers.map((c) => ({
      id: c.id,
      name: c.name,
      eAttributes: 'eAttributes' in c ? (c as any).eAttributes || [] : [],
      eReferences: 'eReferences' in c ? (c as any).eReferences || [] : [],
      abstract: 'abstract' in c ? (c as any).abstract : false,
    }));
  }, [fetchedPkg]);

  const ocl = useOCLValidation(metamodelId, classifierInfo);

  // Build violations map (classifierId → OCLViolations[])
  const violationsMap = useMemo(() => {
    if (!ocl.result?.violations) return undefined;
    const map = new Map<string, Array<{
      constraintId: string; constraintName: string; expression: string;
      severity: 'error' | 'warning' | 'info'; passed: boolean; error?: string;
    }>>();
    ocl.result.violations.forEach((v, key) => {
      map.set(key, v);
    });
    return map;
  }, [ocl.result]);

  // ── useEcoreModel — OCL-aware, always called unconditionally ─
  const model = useEcoreModel({
    projectId,
    metamodelId,
    initialPkg: fetchedPkg,
    violationsMap: violationsMap,
  });

  // ── Colaboración en tiempo real ────────────────────────────
  const [collabUsers, setCollabUsers] = useState<RoomUser[]>([]);
  const [remoteContent, setRemoteContent] = useState<Record<string, any> | null>(null);
  const [socketId, setSocketId] = useState<string>('');

  const collab = useCollaboration(metamodelId, {
    userName: 'Anonymous',
    onRoomUsers: (users) => {
      setCollabUsers(users);
    },
    onModelUpdate: (content) => {
      setRemoteContent(content);
    },
    onModelSynced: (content) => {
      setRemoteContent(content);
    },
  });

  useEffect(() => {
    if (collab.connected && !socketId) {
      setSocketId(`local_${Date.now()}`);
    }
  }, [collab.connected, socketId]);

  // Track mouse position for cursor sharing
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  useEffect(() => {
    if (!collab.connected) return;
    const interval = setInterval(() => {
      collab.sendCursorMove(mousePosRef.current);
    }, 150);
    return () => clearInterval(interval);
  }, [collab.connected, collab.sendCursorMove]);

  // Handle remote content sync
  useEffect(() => {
    if (remoteContent) {
      const pkg: SerializableEPackage = {
        name: (remoteContent as any).name || (fetchedPkg?.name || 'model'),
        nsURI: (remoteContent as any).nsURI || (fetchedPkg?.nsURI || ''),
        nsPrefix: (remoteContent as any).nsPrefix || (fetchedPkg?.nsPrefix || ''),
        eClassifiers: Array.isArray((remoteContent as any).eClassifiers)
          ? (remoteContent as any).eClassifiers : [],
      };
      setFetchedPkg(pkg);
      setRemoteContent(null);
    }
  }, [remoteContent]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Track initial load complete
  if (fetchedPkg && initialLoad.current) {
    initialLoad.current = false;
  }

  // ── Register with EditorContext ────────────────────────────────
  useEffect(() => {
    register(
      {
        save: () => model.save(),
        exportEcore: () => exportEcore(projectId, metamodelId),
        exportZip: () => exportXmiZip(projectId, metamodelId),
        exportGenmodel: () => exportGenmodel(projectId, metamodelId),
        autoLayout: (direction?: 'TB' | 'LR') => {
          model.autoLayout(direction);
          setTimeout(() => reactFlowInstance.fitView({ padding: 0.15, duration: 300 }), 50);
        },
        importEcore: () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.ecore,.xml';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const resp = await fetch(`/api/projects/${projectId}/xmi/${metamodelId}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xml: text }),
              });
              const data = await resp.json();
              if (data.success) {
                window.location.reload();
              } else {
                addToast('Import failed: ' + (data.message || 'Unknown error'), 'error');
              }
            } catch (err: any) {
              addToast('Error importing file: ' + err.message, 'error');
            }
          };
          input.click();
        },
        importEclipseZip: () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.zip';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
              const formData = new FormData();
              formData.append('file', file);
              const resp = await fetch(`/api/projects/${projectId}/xmi/${metamodelId}/import-eclipse-zip`, {
                method: 'POST',
                body: formData,
              });
              const data = await resp.json();
              if (data.success) {
                window.location.reload();
              } else {
                addToast('Import failed: ' + (data.message || 'Unknown error'), 'error');
              }
            } catch (err: any) {
              addToast('Error importing Eclipse project: ' + err.message, 'error');
            }
          };
          input.click();
        },
        undo: () => model.undo(),
        redo: () => model.redo(),
        validate: () => ocl.refresh(),
      },
      {
        dirty: model.isDirty,
        loading: model.loading,
        canUndo: model.canUndo,
        canRedo: model.canRedo,
        validationStatus: ocl.result?.totalViolations
          ? 'invalid'
          : ocl.enabled ? 'valid' : 'unknown',
        totalViolations: ocl.result?.totalViolations ?? 0,
        nodeCount: model.nodes?.length ?? 0,
        edgeCount: model.edges?.length ?? 0,
        packageName: model.pkg?.name ?? '',
        connected: collab.connected,
        collaborators: collabUsers.length,
      },
    );

    return () => {
      unregister();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update EditorContext state on changes ──────────────────────
  useEffect(() => {
    updateState({
      dirty: model.isDirty,
      loading: model.loading,
      canUndo: model.canUndo,
      canRedo: model.canRedo,
      validationStatus: ocl.result?.totalViolations
        ? 'invalid'
        : ocl.enabled ? 'valid' : 'unknown',
      totalViolations: ocl.result?.totalViolations ?? 0,
      nodeCount: model.nodes?.length ?? 0,
      edgeCount: model.edges?.length ?? 0,
      packageName: model.pkg?.name ?? '',
      connected: collab.connected,
      collaborators: collabUsers.length,
    });
  }, [
    model.isDirty, model.loading, model.canUndo, model.canRedo,
    model.nodes?.length, model.edges?.length, model.pkg?.name,
    ocl.result?.totalViolations, ocl.enabled,
    collab.connected, collabUsers.length,
    updateState,
  ]);

  // ── Show/hide right panel on mount/unmount ─────────────────────
  useEffect(() => {
    setRightPanelVisible(true);
    return () => setRightPanelVisible(false);
  }, [setRightPanelVisible]);

  // ── Handlers (memoized, stable references) ──────────────────
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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        if (model.selectedId) {
          model.deleteSelected();
          e.preventDefault();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        model.save();
      }
      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        model.undo();
      }
      // Redo (Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        model.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [model]);

  // ── Node/Edge click handlers ────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback(
    (_: any, node: Node) => {
      const data = node.data as EcoreNodeData;
      const typeMap: Record<string, string> = { eClassNode: 'class', eEnumNode: 'enum', eDataTypeNode: 'dataType' };
      model.setSelected(node.id, typeMap[node.type] ?? 'class');
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

  // ── TreeView selection handler ─────────────────────────────────
  const handleTreeSelect = useCallback((id: string | null) => {
    if (!id) { model.setSelected(null, null); return; }
    const c = model.pkg.eClassifiers.find((x) => x.id === id);
    if (c) {
      const type = isClass(c) ? 'class' : isEnum(c) ? 'enum' : 'dataType';
      model.setSelected(id, type);
      return;
    }
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
  }, [model]);

  // ── Loading state ───────────────────────────────────────────
  if (!fetchedPkg && !fetchError) {
    return (
      <div style={styles.center}>
        <div className="spinner" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading metamodel…</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────
  if (fetchError) {
    return (
      <div style={styles.center}>
        <div style={styles.errorBox}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Failed to load metamodel</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{fetchError}</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={styles.canvas}>
      {/* ── Left Panel Portal (Toolbox + TreeView) ──────────── */}
      {portalsReady && leftPanelRef.current && createPortal(
        <>
          <Toolbox onAdd={model.addClassifier} />
          <div style={{ flex: 1, overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
            <TreeView
              pkg={model.pkg}
              onSelect={handleTreeSelect}
              selectedId={model.selectedId}
            />
          </div>
        </>,
        leftPanelRef.current,
      )}

      {/* ── Right Panel Portal (PropertyInspector + OCL) ────── */}
      {portalsReady && rightPanelRef.current && createPortal(
        <>
          <PropertyInspector
            selectedId={model.selectedId}
            selectedType={model.selectedType as any}
            pkg={model.pkg}
            onClassifierChange={model.handleClassifierChange}
            onAddAttribute={handleAddAttribute}
            onAddReference={handleAddReference}
          />
          <div style={{ flexShrink: 0 }}>
            <OCLValidationPanel
              enabled={ocl.enabled}
              loading={ocl.loading}
              totalViolations={ocl.result?.totalViolations ?? 0}
              totalConstraints={ocl.constraints.length}
              allResults={ocl.result?.allResults ?? []}
              onToggle={ocl.toggleEnabled}
              onRefresh={ocl.refresh}
            />
          </div>
        </>,
        rightPanelRef.current,
      )}

      {/* ── Canvas ─────────────────────────────────────────── */}
      <RemoteCursors users={collabUsers} currentUserSocketId={socketId} />
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
        connectionMode="loose"
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
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
        <Panel position="bottom-center">
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
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{model.edges?.length ?? 0} edges</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{model.pkg.nsPrefix || 'no nsPrefix'}</span>
          </div>
        </Panel>
        <Panel position="top-right">
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => { model.autoLayout('TB'); setTimeout(() => reactFlowInstance.fitView({ padding: 0.15, duration: 300 }), 50); }}
              title="Auto Layout (Top → Bottom)"
              style={{
                padding: '6px 10px', fontSize: 12, fontWeight: 600,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--text)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              ↕ Layout
            </button>
            <button
              onClick={() => { model.autoLayout('LR'); setTimeout(() => reactFlowInstance.fitView({ padding: 0.15, duration: 300 }), 50); }}
              title="Auto Layout (Left → Right)"
              style={{
                padding: '6px 10px', fontSize: 12, fontWeight: 600,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--text)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              ↔ Layout
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Wrapper with ReactFlowProvider + ErrorBoundary
// ═══════════════════════════════════════════════════════════════

export interface EcoreEditorProps {
  projectId: string;
  metamodelId: string;
}

export function EcoreEditor({ projectId, metamodelId }: EcoreEditorProps) {
  const key = `${projectId}/${metamodelId}`;

  return (
    <ErrorBoundary>
      <ReactFlowProvider key={key}>
        <EditorInner projectId={projectId} metamodelId={metamodelId} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

export default EcoreEditor;
