/**
 * @emf-webapp/frontend — SpecEditor
 *
 * Editor visual de sintaxis gráfica (Sirius-like) con canvas React Flow.
 * Layout: Left sidebar (palette + layers) | Center (canvas) | Right (style editor)
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
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
  deleteGraphicalSpec,
  type Metamodel,
  type GraphicalSpec,
} from '../api/client';
import SpecNode, { type SpecNodeData } from '../components/spec-diagram/SpecNode';
import SpecEdge, { type SpecEdgeData } from '../components/spec-diagram/SpecEdge';
import SpecStylePanel from '../components/spec-diagram/SpecStylePanel';
import type { SpecData, Mapping, ShapeStyle, EdgeStyle } from '../components/spec-diagram/types';
import { Save, Trash2, AlertTriangle } from '../components/icons';
import ErrorPanel from '../components/feedback/ErrorPanel';

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_SPEC: SpecData = {
  name: '',
  domain: '',
  layers: [{
    name: 'Principal',
    default: true,
    mappings: [],
  }],
};

function defaultMapping(domainClass: string): Mapping {
  return {
    domainClass,
    semanticCandidatesExpression: `self`,
    style: {
      shape: 'rectangle',
      color: '#6366f1',
      borderColor: '#818cf8',
      borderSize: 2,
      labelExpression: 'self.name',
      labelPosition: 'inside',
    },
    edgeMappings: [],
  };
}

function defaultEdgeStyle(): EdgeStyle {
  return {
    lineStyle: 'solid',
    sourceDecoration: 'none',
    targetDecoration: 'arrow',
    color: '#6366f1',
    labelExpression: 'self.name',
  };
}

/* ------------------------------------------------------------------ */
/*  Node & Edge Types Registry                                         */
/* ------------------------------------------------------------------ */

const nodeTypes = { specNode: SpecNode } as any;
const edgeTypes = { specEdge: SpecEdge } as any;

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Build React Flow nodes from spec data, preserving positions */
function buildNodes(
  mappings: Mapping[],
  posMap: Map<string, { x: number; y: number }>,
  selectedKey: string | null,
): Node<SpecNodeData>[] {
  return mappings.map((m, i) => {
    const key = m.domainClass;
    const savedPos = posMap.get(key);
    return {
      id: key,
      type: 'specNode',
      position: savedPos ?? { x: 80 + (i % 3) * 220, y: 80 + Math.floor(i / 3) * 160 },
      data: {
        label: m.domainClass,
        shape: m.style.shape,
        color: m.style.color,
        borderColor: m.style.borderColor,
        borderSize: m.style.borderSize,
        labelPosition: m.style.labelPosition,
        selected: key === selectedKey,
      },
    };
  });
}

/** Build React Flow edges from spec data */
function buildEdges(
  mappings: Mapping[],
  selectedKey: string | null,
): Edge<SpecEdgeData>[] {
  const edges: Edge<SpecEdgeData>[] = [];
  for (const m of mappings) {
    for (const em of m.edgeMappings || []) {
      const edgeId = `edge-${m.domainClass}->${em.domainClass}`;
      edges.push({
        id: edgeId,
        source: m.domainClass,
        target: em.domainClass,
        type: 'specEdge',
        data: {
          lineStyle: em.style.lineStyle,
          sourceDecoration: em.style.sourceDecoration,
          targetDecoration: em.style.targetDecoration,
          color: em.style.color,
          labelExpression: em.style.labelExpression,
          label: em.domainClass,
        },
        selected: selectedKey === edgeId,
      });
    }
  }
  return edges;
}

/** Create a unique position for a new mapping */
function nextPosition(posMap: Map<string, { x: number; y: number }>, count: number) {
  const baseX = 80 + (count % 3) * 220;
  const baseY = 80 + Math.floor(count / 3) * 160;
  // Shift if overlapping
  let x = baseX;
  let y = baseY;
  let tries = 0;
  while (Array.from(posMap.values()).some(p => Math.abs(p.x - x) < 80 && Math.abs(p.y - y) < 60) && tries < 20) {
    x += 240;
    if (x > 700) { x = 80; y += 180; }
    tries++;
  }
  return { x, y };
}

/* ------------------------------------------------------------------ */
/*  SpecEditor (inner — inside ReactFlowProvider)                       */
/* ------------------------------------------------------------------ */

function SpecEditorInner({ projectId: propProjectId, metamodelId: propMetamodelId }: { projectId?: string; metamodelId?: string }) {
  const { pid, mmid, specId } = useParams<{ pid: string; mmid: string; specId?: string }>();
  const projectId = propProjectId || pid || '';
  const metamodelId = propMetamodelId || mmid || '';

  // Data
  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [specs, setSpecs] = useState<GraphicalSpec[]>([]);
  const [activeSpec, setActiveSpec] = useState<GraphicalSpec | null>(null);
  const [specData, setSpecData] = useState<SpecData>(DEFAULT_SPEC);
  const [eclassNames, setEclassNames] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | ''>('');
  const [selectionType, setSelectionType] = useState<'node' | 'edge' | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Refs
  const lastSavedRef = useRef('');
  const posMapRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Node/edge state for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /* ── Load ─────────────────────────────────────────────────────── */

  useEffect(() => {
    async function load() {
      if (!metamodelId) return;
      setLoading(true);
      try {
        const [mm, sList] = await Promise.all([
          getMetamodel(projectId, metamodelId),
          getGraphicalSpecs(metamodelId),
        ]);
        setMetamodel(mm);
        setSpecs(sList);

        const content = mm.content || {};
        const classifiers: { name: string }[] = content.eClassifiers || [];
        setEclassNames(classifiers.map((c) => c.name));

        if (specId) {
          const spec = sList.find((s) => s.id === specId) ||
            await getGraphicalSpec(metamodelId, specId);
          setActiveSpec(spec);
          const parsed = JSON.parse(spec.spec || '{}');
          const loadedData: SpecData = {
            name: parsed.name || spec.name,
            domain: parsed.domain || '',
            layers: parsed.layers || DEFAULT_SPEC.layers,
          };
          setSpecData(loadedData);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [metamodelId, specId, projectId]);

  /* ── Sync nodes/edges when specData or selection changes ──────── */

  useEffect(() => {
    const allMappings = specData.layers.flatMap((l) => l.mappings);
    const newNodes = buildNodes(allMappings, posMapRef.current, selectedKey);
    const newEdges = buildEdges(allMappings, selectedKey);
    setNodes(newNodes as any);
    setEdges(newEdges as any);
  }, [specData, selectedKey, setNodes, setEdges]);

  /* ── Save ─────────────────────────────────────────────────────── */

  const handleSave = useCallback(async () => {
    if (!metamodelId) return;
    setSaving(true);
    try {
      const specPayload = JSON.stringify(specData);
      if (activeSpec) {
        await updateGraphicalSpec(metamodelId, activeSpec.id, { spec: specPayload });
      } else {
        const created = await createGraphicalSpec(metamodelId, {
          name: specData.name || 'New Spec',
          spec: specPayload,
        });
        setActiveSpec(created);
      }
      lastSavedRef.current = specPayload;
      setSaveStatus('saved');
      setError('');
      const sList = await getGraphicalSpecs(metamodelId);
      setSpecs(sList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [metamodelId, activeSpec, specData]);

  /* ── Auto-save ────────────────────────────────────────────────── */

  useEffect(() => {
    const interval = setInterval(() => {
      const currentContent = JSON.stringify(specData);
      if (currentContent !== lastSavedRef.current) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [handleSave, specData]);

  /* ── Drag -> update posMap ────────────────────────────────────── */

  const onNodesChangeWithPos = useCallback((changes: any[]) => {
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position) {
        posMapRef.current.set(ch.id, ch.position);
      }
    }
    onNodesChange(changes);
  }, [onNodesChange]);

  /* ── Connect nodes -> create edge mapping ─────────────────────── */

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;

    setSpecData((prev) => {
      const layers = [...prev.layers];
      layers[0] = { ...layers[0], mappings: [...layers[0].mappings] };
      const sourceMap = layers[0].mappings.find((m) => m.domainClass === conn.source);
      if (!sourceMap || sourceMap.edgeMappings.some((e) => e.domainClass === conn.target)) {
        return prev; // edge already exists
      }
      const updatedMappings = [...layers[0].mappings];
      const idx = updatedMappings.indexOf(sourceMap);
      updatedMappings[idx] = {
        ...sourceMap,
        edgeMappings: [
          ...sourceMap.edgeMappings,
          {
            domainClass: conn.target,
            sourceMapping: conn.source,
            targetMapping: conn.target,
            style: defaultEdgeStyle(),
          },
        ],
      };
      layers[0] = { ...layers[0], mappings: updatedMappings };
      return { ...prev, layers };
    });
  }, []);

  /* ── Canvas click handlers ────────────────────────────────────── */

  const onNodeClick: NodeMouseHandler = useCallback((_: any, node: Node) => {
    setSelectionType('node');
    setSelectedKey(node.id);
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_: any, edge: Edge) => {
    setSelectionType('edge');
    setSelectedKey(edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectionType(null);
    setSelectedKey(null);
  }, []);

  /* ── Add mapping ──────────────────────────────────────────────── */

  const addMapping = useCallback((domainClass: string) => {
    setSpecData((prev) => {
      // Prevent duplicates
      if (prev.layers[0].mappings.some((m) => m.domainClass === domainClass)) return prev;

      const layers = [...prev.layers];
      const newMapping = defaultMapping(domainClass);
      layers[0] = {
        ...layers[0],
        mappings: [...layers[0].mappings, newMapping],
      };
      return { ...prev, layers };
    });
    // Also reserve a position for the new node
    const count = specData.layers[0].mappings.length;
    if (!posMapRef.current.has(domainClass)) {
      posMapRef.current.set(domainClass, nextPosition(posMapRef.current, count));
    }
  }, [specData]);

  /* ── Remove mapping ──────────────────────────────────────────── */

  const removeMapping = useCallback((domainClass: string) => {
    setSpecData((prev) => {
      const layers = [...prev.layers];
      layers[0] = {
        ...layers[0],
        mappings: layers[0].mappings.filter((m) => m.domainClass !== domainClass),
      };
      return { ...prev, layers };
    });
    posMapRef.current.delete(domainClass);
    if (selectedKey === domainClass) {
      setSelectionType(null);
      setSelectedKey(null);
    }
  }, [selectedKey]);

  /* ── Remove edge mapping ──────────────────────────────────────── */

  const removeEdgeMapping = useCallback((sourceClass: string, targetClass: string) => {
    setSpecData((prev) => {
      const layers = [...prev.layers];
      layers[0] = { ...layers[0], mappings: [...layers[0].mappings] };
      const idx = layers[0].mappings.findIndex((m) => m.domainClass === sourceClass);
      if (idx === -1) return prev;
      const updatedMapping = {
        ...layers[0].mappings[idx],
        edgeMappings: layers[0].mappings[idx].edgeMappings.filter((e) => e.domainClass !== targetClass),
      };
      const updatedMappings = [...layers[0].mappings];
      updatedMappings[idx] = updatedMapping;
      layers[0] = { ...layers[0], mappings: updatedMappings };
      return { ...prev, layers };
    });
  }, []);

  /* ── Style changes (shape) ────────────────────────────────────── */

  const handleShapeStyleChange = useCallback((patch: Partial<ShapeStyle>) => {
    if (!selectedKey || selectionType !== 'node') return;
    setSpecData((prev) => {
      const layers = [...prev.layers];
      layers[0] = { ...layers[0], mappings: [...layers[0].mappings] };
      const idx = layers[0].mappings.findIndex((m) => m.domainClass === selectedKey);
      if (idx === -1) return prev;
      const updatedMappings = [...layers[0].mappings];
      updatedMappings[idx] = {
        ...updatedMappings[idx],
        style: { ...updatedMappings[idx].style, ...patch },
      };
      layers[0] = { ...layers[0], mappings: updatedMappings };
      return { ...prev, layers };
    });
  }, [selectedKey, selectionType]);

  const handleEdgeStyleChange = useCallback((patch: Partial<EdgeStyle>) => {
    if (!selectedKey || selectionType !== 'edge') return;
    // Parse edge key: "edge-SourceClass->TargetClass"
    const match = selectedKey.match(/^edge-(.+)→(.+)$/);
    if (!match) return;
    const [, sourceClass, targetClass] = match;
    setSpecData((prev) => {
      const layers = [...prev.layers];
      layers[0] = { ...layers[0], mappings: [...layers[0].mappings] };
      const mappingIdx = layers[0].mappings.findIndex((m) => m.domainClass === sourceClass);
      if (mappingIdx === -1) return prev;
      const updatedMapping = { ...layers[0].mappings[mappingIdx] };
      updatedMapping.edgeMappings = [...updatedMapping.edgeMappings];
      const edgeIdx = updatedMapping.edgeMappings.findIndex((e) => e.domainClass === targetClass);
      if (edgeIdx === -1) return prev;
      updatedMapping.edgeMappings[edgeIdx] = {
        ...updatedMapping.edgeMappings[edgeIdx],
        style: { ...updatedMapping.edgeMappings[edgeIdx].style, ...patch },
      };
      const updatedMappings = [...layers[0].mappings];
      updatedMappings[mappingIdx] = updatedMapping;
      layers[0] = { ...layers[0], mappings: updatedMappings };
      return { ...prev, layers };
    });
  }, [selectedKey, selectionType]);

  /* ── Resolve selected element info for style panel ────────────── */

  const selectedMapping = useMemo(() => {
    if (!selectedKey || selectionType !== 'node') return null;
    for (const layer of specData.layers) {
      const m = layer.mappings.find((x) => x.domainClass === selectedKey);
      if (m) return m;
    }
    return null;
  }, [selectedKey, selectionType, specData]);

  const selectedEdge = useMemo(() => {
    if (!selectedKey || selectionType !== 'edge') return null;
    const match = selectedKey.match(/^edge-(.+)→(.+)$/);
    if (!match) return null;
    const [, sourceClass, targetClass] = match;
    for (const layer of specData.layers) {
      const m = layer.mappings.find((x) => x.domainClass === sourceClass);
      if (m) {
        const em = m.edgeMappings.find((e) => e.domainClass === targetClass);
        if (em) return em;
      }
    }
    return null;
  }, [selectedKey, selectionType, specData]);

  /* ── Loading state ────────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        {!propProjectId && (
          <Link to={`/projects/${projectId}`} className="back-link" style={{ fontSize: 13 }}>
            ← Back
          </Link>
        )}
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Graphical Syntax — {metamodel?.name}
        </h1>
        <div style={{ flex: 1 }} />

        <select
          value={activeSpec?.id || ''}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              setActiveSpec(null);
              setSpecData(DEFAULT_SPEC);
              setSelectionType(null);
              setSelectedKey(null);
              return;
            }
            const spec = specs.find((s) => s.id === id);
            if (spec) {
              setActiveSpec(spec);
              const parsed = JSON.parse(spec.spec || '{}');
              setSpecData({
                name: parsed.name || spec.name,
                domain: parsed.domain || '',
                layers: parsed.layers || DEFAULT_SPEC.layers,
              });
              setSelectionType(null);
              setSelectedKey(null);
            }
          }}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
            fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)',
            minWidth: 160, color: 'var(--text)',
          }}
        >
          <option value="">— New spec —</option>
          {specs.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <input
          placeholder="Spec name"
          value={specData.name}
          onChange={(e) => setSpecData((p) => ({ ...p, name: e.target.value }))}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
            fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)',
            width: 180, color: 'var(--text)',
          }}
        />

        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Save size={14} /> Save</span>}
        </button>
        {saveStatus === 'saved' && (
          <span style={{ color: '#22c55e', fontSize: 11 }}>Saved</span>
        )}

        {activeSpec && (
          <button
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--danger)', fontSize: 12 }}
            onClick={() => {
              if (!window.confirm('Delete this specification?')) return;
              deleteGraphicalSpec(metamodelId, activeSpec.id)
                .then(() => {
                  setSpecs((s) => s.filter((x) => x.id !== activeSpec.id));
                  setActiveSpec(null);
                  setSpecData(DEFAULT_SPEC);
                  setSelectionType(null);
                  setSelectedKey(null);
                })
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to delete'));
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash2 size={14} /> Delete</span>
          </button>
        )}
      </div>

      {error && <ErrorPanel title="Error" message={error} compact />}

      {/* ── 3-Panel Layout ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left Sidebar — Palette + Layer Info */}
        {specData.layers.map((layer, li) => (
          <div key={li} style={{
            width: 240, flexShrink: 0, overflow: 'auto',
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Layer header */}
            <div style={{
              padding: '12px 14px', borderBottom: '1px solid var(--border)',
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <input
                type="checkbox"
                checked={layer.default}
                onChange={(e) => {
                  setSpecData((prev) => {
                    const layers = [...prev.layers];
                    layers[li] = { ...layers[li], default: e.target.checked };
                    return { ...prev, layers };
                  });
                }}
              />
              {layer.name}
            </div>

            {/* Palette: Available EClasses */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Palette
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {eclassNames.map((ec) => {
                  const isActive = layer.mappings.some((m) => m.domainClass === ec);
                  return (
                    <button
                      key={ec}
                      onClick={() => addMapping(ec)}
                      disabled={isActive}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 6,
                        border: '1px solid transparent',
                        background: isActive ? 'var(--primary-bg)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text)',
                        fontSize: 12, cursor: isActive ? 'default' : 'pointer',
                        textAlign: 'left', fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.target as HTMLElement).style.background = 'var(--bg)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.target as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <span style={{
                        width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                        background: isActive ? 'var(--primary)' : 'var(--text-muted)',
                      }} />
                      {ec}
                      {isActive && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 14px' }} />

            {/* Active Mappings list */}
            <div style={{ padding: '10px 14px', flex: 1, overflow: 'auto' }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>Mappings ({layer.mappings.length})</span>
              </div>
              {layer.mappings.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>
                  Click a class in the palette to add it to the canvas
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {layer.mappings.map((m) => (
                    <div
                      key={m.domainClass}
                      onClick={() => {
                        setSelectionType('node');
                        setSelectedKey(m.domainClass);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
                        fontSize: 12,
                        background: selectedKey === m.domainClass ? 'var(--primary-bg)' : 'transparent',
                        border: selectedKey === m.domainClass
                          ? '1px solid var(--primary)'
                          : '1px solid transparent',
                      }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                        background: m.style.color,
                        border: `2px solid ${m.style.borderColor}`,
                      }} />
                      <span style={{ flex: 1 }}>{m.domainClass}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMapping(m.domainClass);
                        }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-muted)',
                          cursor: 'pointer', fontSize: 11, padding: 2,
                        }}
                        title="Remove mapping"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Edge Mappings sub-list */}
              {layer.mappings.filter((m) => m.edgeMappings.length > 0).length > 0 && (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                    marginTop: 12, marginBottom: 6,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    Connections
                  </div>
                  {layer.mappings.map((m) =>
                    m.edgeMappings.map((em) => (
                      <div key={`${m.domainClass}->${em.domainClass}`} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '3px 8px', fontSize: 11,
                        color: 'var(--text-secondary)',
                      }}>
                        <span>{m.domainClass}</span>
                        <span style={{ opacity: 0.5 }}>→</span>
                        <span>{em.domainClass}</span>
                        <button
                          onClick={() => removeEdgeMapping(m.domainClass, em.domainClass)}
                          style={{
                            marginLeft: 'auto', background: 'none', border: 'none',
                            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {/* Center — React Flow Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes as any}
            edges={edges as any}
            onNodesChange={onNodesChangeWithPos}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={['Backspace', 'Delete']}
            style={{ background: 'var(--bg)' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            <Controls position="bottom-left" style={{ background: 'var(--surface)' }} />
            <MiniMap
              position="bottom-right"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              nodeColor={(n) => (n.data as SpecNodeData)?.color || '#6366f1'}
              maskColor="rgba(0,0,0,0.15)"
            />
            {/* Info panel bottom-center */}
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              fontSize: 11, color: 'var(--text-muted)',
              background: 'var(--surface)', padding: '4px 12px',
              borderRadius: 6, border: '1px solid var(--border)',
              pointerEvents: 'none',
            }}>
              {specData.layers.flatMap((l) => l.mappings).length} mappings ·{' '}
              {specData.layers.flatMap((l) => l.mappings).reduce((a, m) => a + (m.edgeMappings?.length || 0), 0)} edges
              · Drop to connect
            </div>
          </ReactFlow>
        </div>

        {/* Right Sidebar — Style Editor */}
        <SpecStylePanel
          selectionType={selectionType}
          selectionLabel={selectedKey ?? undefined}
          shapeStyle={selectedMapping?.style}
          edgeStyle={selectedEdge?.style}
          edgeInfo={
            selectionType === 'edge' && selectedKey
              ? (() => {
                  const match = selectedKey.match(/^edge-(.+)→(.+)$/);
                  return match
                    ? { source: match[1], target: match[2], sourceMapping: match[1], targetMapping: match[2] }
                    : undefined;
                })()
              : undefined
          }
          onShapeStyleChange={handleShapeStyleChange}
          onEdgeStyleChange={handleEdgeStyleChange}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SpecEditor (exported — wraps in ReactFlowProvider)                  */
/* ------------------------------------------------------------------ */

interface SpecEditorProps {
  projectId?: string;
  metamodelId?: string;
}

export default function SpecEditor(props: SpecEditorProps) {
  // Fill the parent tab container instead of using fixed positioning
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    }}>
      <ReactFlowProvider>
        <SpecEditorInner projectId={props.projectId} metamodelId={props.metamodelId} />
      </ReactFlowProvider>
    </div>
  );
}
