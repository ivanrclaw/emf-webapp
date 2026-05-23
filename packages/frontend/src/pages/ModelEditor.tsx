/**
 * @emf-webapp/frontend — ModelEditor (Rewritten for Sirius VSM)
 *
 * Runtime model editor strictly constrained by the ViewpointSpec.
 * - Palette generated ONLY from VSM ToolSections
 * - Nodes rendered according to NodeMapping styles
 * - Edges rendered according to EdgeMapping styles
 * - Layers toggleable, constraints enforced
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel,
  MarkerType,
  ConnectionMode,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  getMetamodel,
  getM1Model,
  updateM1Model,
  getGraphicalSpecs,
  Metamodel,
  M1Model,
  GraphicalSpec,
} from '../api/client';
import ErrorPanel from '../components/feedback/ErrorPanel';
import type { ViewpointSpec, NodeCreationTool, ContainerCreationTool, EdgeCreationTool, NodeMapping, Tool } from '../components/spec-diagram/types';
import VsmNode, { type VsmNodeData } from '../components/model-editor/VsmNode';
import VsmContainerNode, { type VsmContainerNodeData } from '../components/model-editor/VsmContainerNode';
import VsmEdge, { type VsmEdgeData } from '../components/model-editor/VsmEdge';
import { VsmPalette } from '../components/model-editor/VsmPalette';
import { VsmPropertyInspector } from '../components/model-editor/VsmPropertyInspector';
import { EditorToolbar } from '../components/model-editor/EditorToolbar';
import { EditorStatusBar } from '../components/model-editor/EditorStatusBar';
import { useModelHistory } from '../components/model-editor/hooks/useModelHistory';
import {
  collectActiveToolSections,
  collectActiveMappings,
  collectActiveTools,
  canCreateEdge,
  canDelete,
} from '../lib/vsm-runtime';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface ModelContent {
  objects: SemanticObject[];
  positions: Record<string, { x: number; y: number }>;
  activeLayers: string[];
}

/* ------------------------------------------------------------------ */
/*  Node/Edge type registries                                          */
/* ------------------------------------------------------------------ */

const nodeTypes = {
  vsmNode: VsmNode,
  vsmContainerNode: VsmContainerNode,
} as any;
const edgeTypes = { vsmEdge: VsmEdge } as any;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uid(): string {
  return `obj_${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/*  ModelEditorInner                                                    */
/* ------------------------------------------------------------------ */

function ModelEditorInner(props: { projectId?: string; metamodelId?: string; modelId?: string }) {
  const params = useParams<{ pid: string; mmid: string; modelId: string }>();
  const pid = props.projectId || params.pid;
  const mmid = props.metamodelId || params.mmid;
  const modelId = props.modelId || params.modelId;

  // ─── State ───────────────────────────────────────────────────────
  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [m1Model, setM1Model] = useState<M1Model | null>(null);
  const [spec, setSpec] = useState<ViewpointSpec | null>(null);
  const [objects, setObjects] = useState<SemanticObject[]>([]);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | ''>('');

  // Selection & tools
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);

  // View state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [gridSize] = useState(20);

  // History (undo/redo)
  const history = useModelHistory(null);

  // ReactFlow instance
  const reactFlowInstance = useReactFlow();

  const lastSavedRef = useRef('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // Stores loaded positions so nodes keep their place on re-render
  const savedPositionsRef = useRef<Record<string, { x: number; y: number }>>({}); 

  // ─── Derived from spec + active layers ───────────────────────────
  const toolSections = useMemo(() => {
    if (!spec) return [];
    return collectActiveToolSections(spec, activeLayers);
  }, [spec, activeLayers]);

  const allTools = useMemo(() => {
    if (!spec) return [];
    return collectActiveTools(spec, activeLayers);
  }, [spec, activeLayers]);

  const mappings = useMemo(() => {
    if (!spec) return { nodeMappings: [], containerMappings: [], edgeMappings: [] };
    return collectActiveMappings(spec, activeLayers);
  }, [spec, activeLayers]);

  const allLayers = useMemo(() => {
    if (!spec) return [];
    return [spec.defaultLayer, ...spec.additionalLayers];
  }, [spec]);

  // EClasses from metamodel
  const eclasses = useMemo(() => {
    if (!metamodel?.content?.eClassifiers) return [];
    return metamodel.content.eClassifiers as Array<{
      name: string;
      abstract?: boolean;
      interface?: boolean;
      eAttributes?: { name: string; eType?: string; lowerBound?: number; upperBound?: number }[];
      eReferences?: { name: string; eType?: string; containment?: boolean; lowerBound?: number; upperBound?: number }[];
    }>;
  }, [metamodel]);

  // Selected object
  const selectedObject = useMemo(() => {
    if (!selectedNodeId) return null;
    return objects.find((o) => o.id === selectedNodeId) || null;
  }, [selectedNodeId, objects]);

  const selectedMapping = useMemo(() => {
    if (!selectedObject) return null;
    return mappings.nodeMappings.find((m) => m.domainClass === selectedObject.eClass)
      || mappings.containerMappings.find((m) => m.domainClass === selectedObject.eClass)
      || null;
  }, [selectedObject, mappings]);

  // ─── Load ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!pid || !mmid || !modelId) return;
      setLoading(true);
      try {
        const [mm, m] = await Promise.all([
          getMetamodel(pid, mmid),
          getM1Model(pid, mmid, modelId),
        ]);
        setMetamodel(mm);
        setM1Model(m);

        // Load ViewpointSpec
        try {
          const specs = await getGraphicalSpecs(mmid);
          if (specs.length > 0) {
            const parsed = JSON.parse(specs[0].spec || '{}') as ViewpointSpec;
            setSpec(parsed);
            // Initialize active layers
            const active = new Set<string>();
            active.add(parsed.defaultLayer.id);
            for (const layer of parsed.additionalLayers) {
              if (layer.activeByDefault) active.add(layer.id);
            }
            setActiveLayers(active);
          }
        } catch {
          // No spec — editor will show empty palette
        }

        // Load model content
        if (m.content) {
          try {
            const saved: ModelContent = typeof m.content === 'string'
              ? JSON.parse(m.content)
              : m.content;
            if (saved.objects) setObjects(saved.objects);
            if (saved.positions) savedPositionsRef.current = saved.positions;
            if (saved.activeLayers) {
              setActiveLayers(new Set(saved.activeLayers));
            }
          } catch {
            // Start fresh
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pid, mmid, modelId]);

  // ─── Build ReactFlow nodes/edges from objects + mappings ─────────
  useEffect(() => {
    if (!spec) return;

    // Preserve current ReactFlow node positions before rebuilding
    for (const node of nodes) {
      savedPositionsRef.current[node.id] = node.position;
    }

    const newNodes: Node[] = objects.map((obj) => {
      const mapping = mappings.nodeMappings.find((m) => m.domainClass === obj.eClass)
        || mappings.containerMappings.find((m) => m.domainClass === obj.eClass);

      if (!mapping) {
        // No mapping for this class — render as default
        return {
          id: obj.id,
          type: 'default',
          position: { x: 100, y: 100 },
          data: { label: `${obj.eClass} (unmapped)` },
        };
      }

      const isContainer = 'childrenPresentation' in mapping;
      const savedPos = savedPositionsRef.current[obj.id];
      return {
        id: obj.id,
        type: isContainer ? 'vsmContainerNode' : 'vsmNode',
        position: savedPos ?? { x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 },
        data: {
          mapping,
          semanticData: { ...obj.attributes, name: obj.attributes.name || obj.id, eClass: obj.eClass },
          selected: obj.id === selectedNodeId,
        },
      };
    });

    // Build edges from references + edge mappings
    const newEdges: Edge[] = [];
    for (const obj of objects) {
      for (const [refName, targetIds] of Object.entries(obj.references)) {
        for (const targetId of targetIds) {
          // Find matching edge mapping
          const edgeMapping = mappings.edgeMappings.find(
            (em) => em.sourceReference === refName,
          );
          if (edgeMapping) {
            newEdges.push({
              id: `${obj.id}-${refName}-${targetId}`,
              source: obj.id,
              target: targetId,
              type: 'vsmEdge',
              data: {
                edgeMapping,
                sourceData: obj.attributes,
                selected: false,
              } as VsmEdgeData,
            });
          } else {
            // No edge mapping — render as simple arrow
            newEdges.push({
              id: `${obj.id}-${refName}-${targetId}`,
              source: obj.id,
              target: targetId,
              markerEnd: { type: MarkerType.ArrowClosed },
              label: refName,
              style: { stroke: 'var(--text-muted)', strokeWidth: 1.5 },
            });
          }
        }
      }
    }

    setNodes(newNodes as any);
    setEdges(newEdges as any);
  }, [objects, mappings, spec, setNodes, setEdges]);

  // ─── Update selection independently (without rebuilding all nodes) ─
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === selectedNodeId },
      })),
    );
  }, [selectedNodeId, setNodes]);

  // ─── Save ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!pid || !mmid || !modelId) return;
    setSaving(true);
    try {
      // Collect positions from current nodes
      const positions: Record<string, { x: number; y: number }> = {};
      for (const node of nodes) {
        positions[node.id] = node.position;
      }

      const content: ModelContent = {
        objects,
        positions,
        activeLayers: Array.from(activeLayers),
      };
      const payload = JSON.stringify(content);
      await updateM1Model(pid, mmid, modelId, { content: payload });
      lastSavedRef.current = payload;
      setSaveStatus('saved');
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [pid, mmid, modelId, nodes, objects, activeLayers]);

  // Auto-save
  useEffect(() => {
    const interval = setInterval(() => {
      const current = JSON.stringify({ objects, activeLayers: Array.from(activeLayers) });
      if (current !== lastSavedRef.current) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [handleSave, objects, activeLayers]);

  // ─── Create node from tool ───────────────────────────────────────
  const handleCreateNode = useCallback((tool: NodeCreationTool | ContainerCreationTool) => {
    const newObj: SemanticObject = {
      id: uid(),
      eClass: tool.createType,
      attributes: { name: `${tool.createType}` },
      references: {},
    };
    // Apply initial attributes from tool
    if (tool.initialAttributes) {
      for (const [key, expr] of Object.entries(tool.initialAttributes)) {
        // Simple: strip quotes from string literals
        const val = expr.replace(/^["']|["']$/g, '');
        newObj.attributes[key] = val;
      }
    }
    setObjects((prev) => [...prev, newObj]);
    setSaveStatus('unsaved');
  }, []);

  // ─── Connect (edge creation) ─────────────────────────────────────
  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;

    // Find the active edge creation tool
    const edgeTool = allTools.find(
      (t) => t.id === activeTool && t.type === 'edgeCreation',
    ) as EdgeCreationTool | undefined;

    if (!edgeTool || !edgeTool.referenceToSet) {
      // No edge tool active — ignore
      return;
    }

    // Add reference to source object
    setObjects((prev) => prev.map((obj) => {
      if (obj.id !== conn.source) return obj;
      const refs = { ...obj.references };
      const existing = refs[edgeTool.referenceToSet!] || [];
      if (!existing.includes(conn.target!)) {
        refs[edgeTool.referenceToSet!] = [...existing, conn.target!];
      }
      return { ...obj, references: refs };
    }));
    setSaveStatus('unsaved');
    setActiveTool(null);
    setConnectMode(false);
  }, [activeTool, allTools]);

  // ─── Delete selected ─────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;
    const obj = objects.find((o) => o.id === selectedNodeId);
    if (!obj) return;

    const mapping = mappings.nodeMappings.find((m) => m.domainClass === obj.eClass);
    if (mapping && !canDelete(mapping.id, allTools)) return; // No delete tool

    setObjects((prev) => prev.filter((o) => o.id !== selectedNodeId));
    // Also remove references pointing to deleted object
    setObjects((prev) => prev.map((o) => {
      const refs = { ...o.references };
      for (const [key, targets] of Object.entries(refs)) {
        refs[key] = targets.filter((t) => t !== selectedNodeId);
      }
      return { ...o, references: refs };
    }));
    setSelectedNodeId(null);
    setSaveStatus('unsaved');
  }, [selectedNodeId, objects, mappings, allTools]);

  // ─── Update attribute ────────────────────────────────────────────
  const handleUpdateAttribute = useCallback((key: string, value: unknown) => {
    if (!selectedNodeId) return;
    setObjects((prev) => prev.map((obj) =>
      obj.id === selectedNodeId
        ? { ...obj, attributes: { ...obj.attributes, [key]: value } }
        : obj,
    ));
    setSaveStatus('unsaved');
  }, [selectedNodeId]);

  const handleDirectEdit = useCallback((value: string) => {
    // Direct edit updates the label — handled via handleUpdateAttribute
  }, []);

  // ─── Reference management ───────────────────────────────────────
  const handleAddReference = useCallback((refName: string, targetId: string) => {
    if (!selectedNodeId) return;
    setObjects((prev) => prev.map((obj) => {
      if (obj.id !== selectedNodeId) return obj;
      const refs = { ...obj.references };
      const existing = refs[refName] || [];
      if (!existing.includes(targetId)) {
        refs[refName] = [...existing, targetId];
      }
      return { ...obj, references: refs };
    }));
    setSaveStatus('unsaved');
  }, [selectedNodeId]);

  const handleRemoveReference = useCallback((refName: string, targetId: string) => {
    if (!selectedNodeId) return;
    setObjects((prev) => prev.map((obj) => {
      if (obj.id !== selectedNodeId) return obj;
      const refs = { ...obj.references };
      refs[refName] = (refs[refName] || []).filter((id) => id !== targetId);
      if (refs[refName].length === 0) delete refs[refName];
      return { ...obj, references: refs };
    }));
    setSaveStatus('unsaved');
  }, [selectedNodeId]);

  const handleNavigateToObject = useCallback((objectId: string) => {
    setSelectedNodeId(objectId);
    // Center view on the node
    const node = nodes.find((n) => n.id === objectId);
    if (node && reactFlowInstance) {
      reactFlowInstance.setCenter(
        node.position.x + 80,
        node.position.y + 30,
        { zoom: 1.2, duration: 300 },
      );
    }
  }, [nodes, reactFlowInstance]);

  // ─── Undo/Redo ──────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      setObjects(prev as SemanticObject[]);
      setSaveStatus('unsaved');
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) {
      setObjects(next as SemanticObject[]);
      setSaveStatus('unsaved');
    }
  }, [history]);

  // Push to history whenever objects change (debounced inside hook)
  useEffect(() => {
    if (objects.length > 0 || history.historySize > 0) {
      history.push(objects);
    }
  }, [objects]);

  // ─── Duplicate selected ─────────────────────────────────────────
  const handleDuplicate = useCallback(() => {
    if (!selectedNodeId) return;
    const obj = objects.find((o) => o.id === selectedNodeId);
    if (!obj) return;

    const newObj: SemanticObject = {
      id: uid(),
      eClass: obj.eClass,
      attributes: { ...obj.attributes, name: `${obj.attributes.name || obj.eClass}_copy` },
      references: { ...obj.references },
    };
    setObjects((prev) => [...prev, newObj]);
    // Offset position for the duplicate
    const pos = savedPositionsRef.current[selectedNodeId];
    if (pos) {
      savedPositionsRef.current[newObj.id] = { x: pos.x + 30, y: pos.y + 30 };
    }
    setSelectedNodeId(newObj.id);
    setSaveStatus('unsaved');
  }, [selectedNodeId, objects]);

  // ─── Select all ─────────────────────────────────────────────────
  const handleSelectAll = useCallback(() => {
    // Select first node (multi-select will come in Sprint 3)
    if (objects.length > 0) {
      setSelectedNodeId(objects[0].id);
    }
  }, [objects]);

  // ─── Layer toggle ────────────────────────────────────────────────
  const handleToggleLayer = useCallback((layerId: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  // ─── Tool selection ──────────────────────────────────────────────
  const handleSelectTool = useCallback((toolId: string | null) => {
    setActiveTool(toolId);
    const tool = allTools.find((t) => t.id === toolId);
    setConnectMode(tool?.type === 'edgeCreation');
  }, [allTools]);

  // ─── Canvas interactions ─────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      if (isInput) return;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) handleDelete();
        return;
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) handleRedo();
            else handleUndo();
            break;
          case 'd':
            e.preventDefault();
            handleDuplicate();
            break;
          case 'a':
            e.preventDefault();
            handleSelectAll();
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, handleDelete, handleUndo, handleRedo, handleDuplicate, handleSelectAll, handleSave]);

  // ─── Export ──────────────────────────────────────────────────────
  const handleExport = useCallback((format: 'json' | 'xmi' | 'svg') => {
    if (format === 'svg') {
      // Export the ReactFlow canvas as SVG
      const svgEl = document.querySelector('.react-flow__viewport');
      if (svgEl) {
        const svgClone = svgEl.cloneNode(true) as Element;
        const svgWrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgWrap.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgWrap.setAttribute('width', '1200');
        svgWrap.setAttribute('height', '800');
        svgWrap.appendChild(svgClone);
        const blob = new Blob([svgWrap.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
      return;
    }

    const data = format === 'json'
      ? JSON.stringify({ objects }, null, 2)
      : objects.map((o) => `  <${o.eClass} name="${o.attributes.name || o.id}"/>`).join('\n');

    const blob = new Blob([format === 'xmi' ? `<?xml version="1.0"?>\n<Model>\n${data}\n</Model>` : data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [objects]);

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  if (error && !metamodel) {
    return <ErrorPanel title="Error" message={error} compact />;
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Toolbar */}
      <EditorToolbar
        projectId={pid || ''}
        metamodelId={mmid || ''}
        modelName={m1Model?.name || 'Model Editor'}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasSelection={!!selectedNodeId}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onSelectAll={handleSelectAll}
        zoomLevel={zoomLevel}
        onZoomIn={() => reactFlowInstance.zoomIn()}
        onZoomOut={() => reactFlowInstance.zoomOut()}
        onFitView={() => reactFlowInstance.fitView()}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        layers={allLayers}
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        saving={saving}
        saveStatus={saveStatus}
        onSave={handleSave}
        onExport={handleExport}
      />

      {error && (
        <div style={{ padding: '6px 20px' }}>
          <ErrorPanel title="Error" message={error} compact />
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left — VSM Palette */}
        <div style={{
          width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
          overflowY: 'auto', flexShrink: 0,
        }}>
          <VsmPalette
            toolSections={toolSections}
            activeTool={activeTool}
            onSelectTool={handleSelectTool}
            onCreateNode={handleCreateNode}
            connectMode={connectMode}
            hasSelection={!!selectedNodeId}
          />
        </div>

        {/* Center — Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onMoveEnd={(_, viewport) => setZoomLevel(viewport.zoom)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={connectMode ? ConnectionMode.Loose : ConnectionMode.Strict}
            fitView
            minZoom={0.3}
            maxZoom={2}
            snapToGrid={showGrid}
            snapGrid={[gridSize, gridSize]}
          >
            {showGrid && <Background gap={gridSize} size={1} />}
            <Controls position="bottom-left" showZoom={false} showFitView={false} />
            {showMinimap && <MiniMap position="bottom-right" pannable zoomable />}
            {!spec && (
              <Panel position="top-center">
                <div style={{
                  padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 13, color: 'var(--text-muted)',
                }}>
                  No Viewpoint Specification found. Create one in the Spec Editor to enable constrained modeling.
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right — Property Inspector */}
        <div style={{
          width: 280, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          overflow: 'hidden', flexShrink: 0,
        }}>
          <VsmPropertyInspector
            semanticData={selectedObject?.attributes || null}
            selectedObject={selectedObject}
            mapping={selectedMapping}
            tools={allTools}
            allObjects={objects}
            eclasses={eclasses}
            onUpdateAttribute={handleUpdateAttribute}
            onDirectEdit={handleDirectEdit}
            onAddReference={handleAddReference}
            onRemoveReference={handleRemoveReference}
            onNavigateToObject={handleNavigateToObject}
            onDelete={selectedNodeId ? handleDelete : undefined}
          />
        </div>
      </div>

      {/* Status Bar */}
      <EditorStatusBar
        zoomLevel={zoomLevel}
        onResetZoom={() => reactFlowInstance.zoomTo(1)}
        nodeCount={objects.length}
        edgeCount={edges.length}
        selectedName={selectedObject?.attributes?.name as string || null}
        selectedType={selectedObject?.eClass || null}
        validationErrors={0}
        validationWarnings={0}
        showGrid={showGrid}
        gridSize={gridSize}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wrapper                                                            */
/* ------------------------------------------------------------------ */

export default function ModelEditor(props: { projectId?: string; metamodelId?: string; modelId?: string }) {
  return (
    <ReactFlowProvider>
      <ModelEditorInner {...props} />
    </ReactFlowProvider>
  );
}
