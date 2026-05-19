/**
 * @emf-webapp/frontend — SpecEditor (Rewritten for Sirius VSM)
 *
 * Full Viewpoint Specification editor with:
 * - Left: MetamodelBrowser + LayerPanel + ToolBuilder
 * - Center: ReactFlow canvas with mapping previews
 * - Right: SpecStylePanel (node/edge style + conditional styles)
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  getMetamodel,
  getGraphicalSpec,
  getGraphicalSpecs,
  createGraphicalSpec,
  updateGraphicalSpec,
  type Metamodel,
  type GraphicalSpec,
} from '../api/client';
import SpecNode, { type SpecNodeData } from '../components/spec-diagram/SpecNode';
import SpecEdge, { type SpecEdgeData } from '../components/spec-diagram/SpecEdge';
import SpecContainerNode, { type SpecContainerNodeData } from '../components/spec-diagram/SpecContainerNode';
import SpecStylePanel from '../components/spec-diagram/SpecStylePanel';
import { MetamodelBrowser } from '../components/spec-editor/MetamodelBrowser';
import { LayerPanel } from '../components/spec-editor/LayerPanel';
import { ToolBuilder } from '../components/spec-editor/ToolBuilder';
import type {
  ViewpointSpec,
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
  ToolSection,
  NodeStyle,
  EdgeStyleSpec,
} from '../components/spec-diagram/types';
import {
  createDefaultViewpointSpec,
  createDefaultNodeStyle,
  createDefaultEdgeStyle,
  createDefaultLayer,
} from '../components/spec-diagram/types';
import { generateViewpointSpec, type MetamodelInput } from '../lib/spec-generator';
import { Save, Trash2, AlertTriangle, Wand2 } from '../components/icons';
import ErrorPanel from '../components/feedback/ErrorPanel';

/* ------------------------------------------------------------------ */
/*  Node/Edge type registries                                          */
/* ------------------------------------------------------------------ */

const nodeTypes = {
  specNode: SpecNode,
  specContainerNode: SpecContainerNode,
} as any;
const edgeTypes = { specEdge: SpecEdge } as any;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Convert ViewpointSpec layer mappings to ReactFlow nodes */
function buildNodes(
  layer: Layer,
  posMap: Map<string, { x: number; y: number }>,
  selectedId: string | null,
): Node[] {
  const nodes: Node[] = [];
  let idx = 0;

  for (const nm of layer.nodeMappings) {
    const pos = posMap.get(nm.id) ?? { x: 80 + (idx % 4) * 240, y: 80 + Math.floor(idx / 4) * 180 };
    nodes.push({
      id: nm.id,
      type: 'specNode',
      position: pos,
      data: { mapping: nm, selected: nm.id === selectedId } as SpecNodeData,
    });
    idx++;
  }

  for (const cm of layer.containerMappings) {
    const pos = posMap.get(cm.id) ?? { x: 80 + (idx % 4) * 240, y: 80 + Math.floor(idx / 4) * 180 };
    nodes.push({
      id: cm.id,
      type: 'specContainerNode',
      position: pos,
      data: { mapping: cm, selected: cm.id === selectedId } as SpecContainerNodeData,
    });
    idx++;
  }

  return nodes;
}

/** Convert EdgeMappings to ReactFlow edges */
function buildEdges(layer: Layer, selectedId: string | null): Edge[] {
  const edges: Edge[] = [];
  for (const em of layer.edgeMappings) {
    // Draw one edge per source→target mapping pair for preview
    const sourceId = em.sourceMappingIds[0];
    const targetId = em.targetMappingIds[0];
    if (!sourceId || !targetId) continue;
    edges.push({
      id: em.id,
      source: sourceId,
      target: targetId,
      type: 'specEdge',
      data: { edgeMapping: em, selected: em.id === selectedId } as SpecEdgeData,
    });
  }
  return edges;
}

/* ------------------------------------------------------------------ */
/*  SpecEditorInner                                                    */
/* ------------------------------------------------------------------ */

function SpecEditorInner({ projectId: propPid, metamodelId: propMmid }: { projectId?: string; metamodelId?: string }) {
  const { pid, mmid, specId } = useParams<{ pid: string; mmid: string; specId?: string }>();
  const projectId = propPid || pid || '';
  const metamodelId = propMmid || mmid || '';

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
  const [selectedType, setSelectedType] = useState<'node' | 'container' | 'edge' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Position map for nodes
  const posMapRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastSavedRef = useRef('');

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

  const existingMappings = useMemo(() => {
    if (!activeLayer) return [];
    return [
      ...activeLayer.nodeMappings.map((m) => m.domainClass),
      ...activeLayer.containerMappings.map((m) => m.domainClass),
    ];
  }, [activeLayer]);

  const existingEdgeMappings = useMemo(() => {
    if (!activeLayer) return [];
    return activeLayer.edgeMappings.map((em) => {
      const srcClasses = em.sourceMappingIds
        .map((id) => activeLayer.nodeMappings.find((n) => n.id === id)?.domainClass)
        .filter(Boolean);
      const tgtClasses = em.targetMappingIds
        .map((id) => activeLayer.nodeMappings.find((n) => n.id === id)?.domainClass)
        .filter(Boolean);
      const refName = em.sourceReference || '';
      return srcClasses.flatMap((s) => tgtClasses.map((t) => `${s}.${refName}.${t}`));
    }).flat();
  }, [activeLayer]);

  const allLayers = useMemo(() => {
    if (!spec) return [];
    return [spec.defaultLayer, ...spec.additionalLayers];
  }, [spec]);

  // Selected mapping for style panel
  const selectedNodeMapping = useMemo(() => {
    if (!selectedId || !activeLayer || selectedType !== 'node') return undefined;
    return activeLayer.nodeMappings.find((m) => m.id === selectedId)
      || activeLayer.containerMappings.find((m) => m.id === selectedId);
  }, [selectedId, selectedType, activeLayer]);

  const selectedEdgeMapping = useMemo(() => {
    if (!selectedId || !activeLayer || selectedType !== 'edge') return undefined;
    return activeLayer.edgeMappings.find((m) => m.id === selectedId);
  }, [selectedId, selectedType, activeLayer]);

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
        } else if (specs.length > 0) {
          setActiveSpec(specs[0]);
          const parsed = JSON.parse(specs[0].spec || '{}') as ViewpointSpec;
          setSpec(parsed);
        } else {
          // No spec exists — create empty
          const empty = createDefaultViewpointSpec(metamodelId);
          setSpec(empty);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [metamodelId, specId, projectId]);

  // ─── Sync ReactFlow when spec/layer/selection changes ────────────
  useEffect(() => {
    if (!activeLayer) return;
    setNodes(buildNodes(activeLayer, posMapRef.current, selectedId) as any);
    setEdges(buildEdges(activeLayer, selectedId) as any);
  }, [activeLayer, selectedId, setNodes, setEdges]);

  // ─── Track node positions ────────────────────────────────────────
  const handleNodesChange = useCallback((changes: any[]) => {
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position) {
        posMapRef.current.set(ch.id, ch.position);
      }
    }
    onNodesChange(changes);
  }, [onNodesChange]);

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

  // Auto-save
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
  }, [metamodel, metamodelId]);

  // ─── Spec mutation helpers ───────────────────────────────────────
  const updateSpec = useCallback((updater: (prev: ViewpointSpec) => ViewpointSpec) => {
    setSpec((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setSaveStatus('unsaved');
      return next;
    });
  }, []);

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
  }, [updateActiveLayer]);

  // ─── Add edge mapping ────────────────────────────────────────────
  const handleAddEdgeMapping = useCallback((sourceClass: string, refName: string, targetClass: string) => {
    if (!activeLayer) return;
    const sourceMappingIds = activeLayer.nodeMappings
      .filter((m) => m.domainClass === sourceClass)
      .map((m) => m.id);
    const targetMappingIds = activeLayer.nodeMappings
      .filter((m) => m.domainClass === targetClass)
      .map((m) => m.id);

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
  }, [activeLayer, updateActiveLayer]);

  // ─── Connect on canvas → create edge mapping ────────────────────
  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || !activeLayer) return;
    // Check if edge already exists
    const exists = activeLayer.edgeMappings.some(
      (em) => em.sourceMappingIds.includes(conn.source!) && em.targetMappingIds.includes(conn.target!),
    );
    if (exists) return;

    const newEdge: EdgeMapping = {
      id: `em_${uid()}`,
      type: 'relation-based',
      sourceMappingIds: [conn.source],
      targetMappingIds: [conn.target],
      targetFinderExpression: 'self',
      defaultStyle: createDefaultEdgeStyle(),
      conditionalStyles: [],
    };
    updateActiveLayer((layer) => ({
      ...layer,
      edgeMappings: [...layer.edgeMappings, newEdge],
    }));
  }, [activeLayer, updateActiveLayer]);

  // ─── Layer management ────────────────────────────────────────────
  const handleAddLayer = useCallback(() => {
    const newLayer = createDefaultLayer(`layer_${uid()}`);
    newLayer.name = `Layer ${(spec?.additionalLayers.length || 0) + 2}`;
    newLayer.isDefault = false;
    newLayer.activeByDefault = true;
    updateSpec((prev) => ({
      ...prev,
      additionalLayers: [...prev.additionalLayers, newLayer],
    }));
  }, [spec, updateSpec]);

  const handleRemoveLayer = useCallback((layerId: string) => {
    updateSpec((prev) => ({
      ...prev,
      additionalLayers: prev.additionalLayers.filter((l) => l.id !== layerId),
    }));
    if (activeLayerId === layerId) setActiveLayerId(spec?.defaultLayer.id || 'layer_default');
  }, [activeLayerId, spec, updateSpec]);

  const handleRenameLayer = useCallback((layerId: string, newName: string) => {
    updateSpec((prev) => {
      if (prev.defaultLayer.id === layerId) {
        return { ...prev, defaultLayer: { ...prev.defaultLayer, name: newName } };
      }
      return {
        ...prev,
        additionalLayers: prev.additionalLayers.map((l) =>
          l.id === layerId ? { ...l, name: newName } : l,
        ),
      };
    });
  }, [updateSpec]);

  const handleToggleLayerActive = useCallback((layerId: string) => {
    updateSpec((prev) => ({
      ...prev,
      additionalLayers: prev.additionalLayers.map((l) =>
        l.id === layerId ? { ...l, activeByDefault: !l.activeByDefault } : l,
      ),
    }));
  }, [updateSpec]);

  // ─── Tool sections update ────────────────────────────────────────
  const handleUpdateToolSections = useCallback((sections: ToolSection[]) => {
    updateActiveLayer((layer) => ({ ...layer, toolSections: sections }));
  }, [updateActiveLayer]);

  // ─── Style updates ───────────────────────────────────────────────
  const handleUpdateNodeMapping = useCallback((patch: Partial<NodeMapping>) => {
    if (!selectedId) return;
    updateActiveLayer((layer) => ({
      ...layer,
      nodeMappings: layer.nodeMappings.map((m) =>
        m.id === selectedId ? { ...m, ...patch } : m,
      ),
      containerMappings: layer.containerMappings.map((m) =>
        m.id === selectedId ? { ...m, ...patch } : m,
      ),
    }));
  }, [selectedId, updateActiveLayer]);

  const handleUpdateEdgeMapping = useCallback((patch: Partial<EdgeMapping>) => {
    if (!selectedId) return;
    updateActiveLayer((layer) => ({
      ...layer,
      edgeMappings: layer.edgeMappings.map((m) =>
        m.id === selectedId ? { ...m, ...patch } : m,
      ),
    }));
  }, [selectedId, updateActiveLayer]);

  // ─── Canvas interactions ─────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_: any, node: Node) => {
    const isContainer = node.type === 'specContainerNode';
    setSelectedType(isContainer ? 'container' : 'node');
    setSelectedId(node.id);
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_: any, edge: Edge) => {
    setSelectedType('edge');
    setSelectedId(edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedType(null);
    setSelectedId(null);
  }, []);

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
      }}>
        <input
          type="text"
          value={spec?.name || ''}
          onChange={(e) => updateSpec((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Viewpoint name..."
          style={{
            background: 'transparent', border: 'none', color: 'var(--text)',
            fontSize: 15, fontWeight: 600, outline: 'none', width: 200,
          }}
        />
        <div style={{ flex: 1 }} />
        {saveStatus === 'saved' && <span style={{ color: 'var(--success)', fontSize: 11 }}>Saved</span>}
        {saveStatus === 'unsaved' && <span style={{ color: 'var(--warning)', fontSize: 11 }}>Unsaved</span>}
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
        {/* Left Panel */}
        <div style={{
          width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            <MetamodelBrowser
              eclasses={eclasses}
              existingMappings={existingMappings}
              existingEdgeMappings={existingEdgeMappings}
              onAddNodeMapping={handleAddNodeMapping}
              onAddEdgeMapping={handleAddEdgeMapping}
            />
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <LayerPanel
              layers={allLayers}
              activeLayerId={activeLayerId}
              onSelectLayer={setActiveLayerId}
              onAddLayer={handleAddLayer}
              onRemoveLayer={handleRemoveLayer}
              onRenameLayer={handleRenameLayer}
              onToggleActive={handleToggleLayerActive}
            />
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <ToolBuilder
              toolSections={activeLayer?.toolSections || []}
              nodeMappings={activeLayer?.nodeMappings || []}
              edgeMappings={activeLayer?.edgeMappings || []}
              onUpdateToolSections={handleUpdateToolSections}
            />
          </div>
        </div>

        {/* Center Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            minZoom={0.3}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls position="bottom-left" />
            <MiniMap position="bottom-right" pannable zoomable />
          </ReactFlow>
        </div>

        {/* Right Panel */}
        <div style={{
          width: 300, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          overflowY: 'auto', flexShrink: 0,
        }}>
          <SpecStylePanel
            selectedType={selectedType}
            nodeMapping={selectedNodeMapping}
            edgeMapping={selectedEdgeMapping}
            onUpdateNodeMapping={handleUpdateNodeMapping}
            onUpdateEdgeMapping={handleUpdateEdgeMapping}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wrapper with ReactFlowProvider                                     */
/* ------------------------------------------------------------------ */

export default function SpecEditor(props: { projectId?: string; metamodelId?: string }) {
  return (
    <ReactFlowProvider>
      <SpecEditorInner {...props} />
    </ReactFlowProvider>
  );
}
