import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel,
  SelectionMode,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  getMetamodel,
  getM1Model,
  updateM1Model,
  Metamodel,
  M1Model,
} from '../api/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EClassifier {
  eClass: string;
  name: string;
  $ref?: string;
}

interface EAttribute {
  eClass: string;
  name: string;
  eType: EClassifier;
  lowerBound?: number;
  upperBound?: number;
  defaultValueLiteral?: string;
}

interface EReference {
  eClass: string;
  name: string;
  eType: EClassifier;
  lowerBound?: number;
  upperBound?: number;
  containment?: boolean;
  eOpposite?: EClassifier;
}

interface EClassData {
  eClass: string;
  name: string;
  eStructuralFeatures: (EAttribute | EReference)[];
  abstract?: boolean;
  interface?: boolean;
}

interface EPackage {
  eClass: string;
  name: string;
  nsURI: string;
  nsPrefix: string;
  eClassifiers: EClassData[];
}

/* React Flow node data */
interface M1ObjectNodeData {
  eClassName: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
  label: string;
  eClass: EClassData;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseMetamodel(content: Record<string, any>): EPackage | null {
  if (!content || !content.eClassifiers) return null;

  // Format A: ya tiene eClass (EPackage nativo)
  if (content.eClass) return content as unknown as EPackage;

  // Format B: SerializableEPackage del editor Ecore (sin eClass, usa eAttributes/eReferences)
  return {
    eClass: 'ecore:EPackage',
    name: content.name || '',
    nsURI: content.nsURI || '',
    nsPrefix: content.nsPrefix || '',
    eClassifiers: (content.eClassifiers || [])
      .filter((c: any) => 'abstract' in c || 'interface' in c) // solo EClass (no EEnum/EDataType)
      .map((c: any) => {
        const features: (EAttribute | EReference)[] = [];
        for (const attr of c.eAttributes || []) {
          features.push({
            eClass: 'ecore:EAttribute',
            name: attr.name,
            eType: { eClass: 'ecore:EDataType', name: attr.eType || 'EString' },
            lowerBound: attr.lowerBound ?? 0,
            upperBound: attr.upperBound ?? 1,
            defaultValueLiteral: attr.defaultValueLiteral,
          });
        }
        for (const ref of c.eReferences || []) {
          features.push({
            eClass: 'ecore:EReference',
            name: ref.name,
            eType: { eClass: 'ecore:EClass', name: ref.targetId, $ref: ref.targetId },
            lowerBound: ref.lowerBound ?? 0,
            upperBound: ref.upperBound ?? 1,
            containment: ref.containment,
            eOpposite: ref.eOpposite ? { eClass: 'ecore:EReference', name: ref.eOpposite } : undefined,
          });
        }
        return {
          eClass: 'ecore:EClass',
          name: c.name,
          eStructuralFeatures: features,
          abstract: c.abstract ?? false,
          interface: c.interface ?? false,
        } as EClassData;
      }),
  } as EPackage;
}

function concreteEClasses(epkg: EPackage): EClassData[] {
  return (epkg.eClassifiers || []).filter(
    (c) => !c.abstract && !c.interface,
  );
}

function generateId(): string {
  return `obj_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultAttributes(eClass: EClassData): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const feat of eClass.eStructuralFeatures || []) {
    if ('eType' in feat && 'lowerBound' in feat) {
      // It's an EAttribute based on having those fields
      const attr = feat as EAttribute;
      if (attr.defaultValueLiteral !== undefined) {
        attrs[attr.name] = attr.defaultValueLiteral;
      } else if (attr.eType?.name === 'EInt' || attr.eType?.name === 'EBigDecimal') {
        attrs[attr.name] = 0;
      } else if (attr.eType?.name === 'EBoolean') {
        attrs[attr.name] = false;
      } else if (attr.eType?.name === 'EEnum') {
        attrs[attr.name] = '';
      } else {
        attrs[attr.name] = '';
      }
    }
  }
  return attrs;
}

/* ------------------------------------------------------------------ */
/*  ModelEditorInner (wrapped in ReactFlowProvider)                    */
/* ------------------------------------------------------------------ */

function ModelEditorInner() {
  const { pid, mmid, modelId } = useParams<{ pid: string; mmid: string; modelId: string }>();

  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [m1Model, setM1Model] = useState<M1Model | null>(null);
  const [epkg, setEpkg] = useState<EPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | ''>('');
  const [selectedNode, setSelectedNode] = useState<Node<M1ObjectNodeData> | null>(null);
  const [exportOutput, setExportOutput] = useState('');

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef('');

  const [nodes, setNodes, onNodesChange] = useNodesState<M1ObjectNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /* Load data */
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

        const pkg = parseMetamodel(mm.content || {});
        setEpkg(pkg);

        /* Deserialize saved content */
        if (m.content && m.content !== '[]') {
          try {
            const saved = JSON.parse(m.content);
            if (saved.nodes) setNodes(saved.nodes);
            if (saved.edges) setEdges(saved.edges);
          } catch {
            // start fresh
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

  /* Save */
  const handleSave = useCallback(async () => {
    if (!pid || !mmid || !modelId) return;
    setSaving(true);
    try {
      const content = JSON.stringify({ nodes, edges });
      await updateM1Model(pid, mmid, modelId, { content });
      lastSavedRef.current = content;
      setSaveStatus('saved');
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [pid, mmid, modelId, nodes, edges]);

  /* Auto-save every 30 seconds */
  useEffect(() => {
    const interval = setInterval(() => {
      const currentContent = JSON.stringify({ nodes, edges });
      if (currentContent !== lastSavedRef.current) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [handleSave, nodes, edges]);

  /* Export */
  const handleExport = useCallback((format: 'json' | 'xmi') => {
    if (format === 'json') {
      setExportOutput(JSON.stringify({ nodes, edges }, null, 2));
    } else {
      /* Simple XMI-like export */
      let xmi = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xmi += `<${epkg?.nsPrefix || 'model'}:${epkg?.name || 'Model'} xmlns:${epkg?.nsPrefix || 'model'}="${epkg?.nsURI || ''}" xml:version="2.0">\n`;
      for (const node of nodes) {
        const data = node.data;
        xmi += `  <${data.eClassName} name="${data.label}">\n`;
        for (const [key, val] of Object.entries(data.attributes)) {
          xmi += `    <${key}>${String(val)}</${key}>\n`;
        }
        xmi += `  </${data.eClassName}>\n`;
      }
      xmi += `</${epkg?.nsPrefix || 'model'}:${epkg?.name || 'Model'}>\n`;
      setExportOutput(xmi);
    }
  }, [nodes, epkg]);

  /* Add node from palette */
  const addObjectNode = useCallback((eClass: EClassData) => {
    const id = generateId();
    const label = `${eClass.name}_${nodes.filter(n => n.data?.eClassName === eClass.name).length + 1}`;
    const newNode: Node<M1ObjectNodeData> = {
      id,
      type: 'default',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {
        eClassName: eClass.name,
        attributes: defaultAttributes(eClass),
        references: {},
        label,
        eClass,
      },
      style: {
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '12px 16px',
        color: '#e2e8f0',
        fontSize: 13,
        minWidth: 160,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes]);

  /* Connect edges */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        style: { stroke: '#6366f1', strokeWidth: 2 },
      }, eds));
    },
    [setEdges],
  );

  /* Selection */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<M1ObjectNodeData>) => {
      setSelectedNode(node);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /* Update attribute */
  const updateAttribute = useCallback((key: string, value: unknown) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, attributes: { ...n.data.attributes, [key]: value } } }
          : n,
      ),
    );
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, attributes: { ...prev.data.attributes, [key]: value } } } : prev,
    );
  }, [selectedNode, setNodes]);

  /* ── Loading ──────────────────────── */
  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  if (error && !metamodel) {
    return <div className="msg msg-error">⚠️ {error}</div>;
  }

  const paletteItems = epkg ? concreteEClasses(epkg) : [];

  /* Non-attribute fields (references) for inspector */
  const refFields = selectedNode
    ? (selectedNode.data.eClass.eStructuralFeatures || []).filter(
        (f) => !('eType' in f) || 'upperBound' in f!,
      )
        .filter((f) => {
          // It's a ref if it has containment/eOpposite
          const ref = f as EReference;
          return ref.containage !== undefined || ref.eOpposite !== undefined;
        })
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a' }}>
      {/* ── Toolbar ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
        background: '#1e293b', borderBottom: '1px solid #334155', flexShrink: 0,
      }}>
        <Link to={`/projects/${pid}/metamodels/${mmid}/models`} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>
          ← Models
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#94a3b8', fontSize: 13 }}>
          {m1Model?.name || 'Model Editor'}
        </span>
        <div style={{ flex: 1 }} />
        {saveStatus === 'saved' && (
          <span style={{ color: '#22c55e', fontSize: 12 }}>Saved</span>
        )}
        {saveStatus === 'unsaved' && (
          <span style={{ color: '#f59e0b', fontSize: 12 }}>Unsaved changes</span>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('json')}>
          📥 JSON
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('xmi')}>
          📥 XMI
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : '💾 Save'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '6px 20px', background: '#7f1d1d', color: '#fca5a5', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Palette ───────────────────────────────────────── */}
        <div style={{
          width: 200, background: '#1e293b', borderRight: '1px solid #334155',
          padding: 12, overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Palette
          </div>
          {paletteItems.length === 0 && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              No concrete EClasses found in metamodel
            </div>
          )}
          {paletteItems.map((ec) => (
            <div
              key={ec.name}
              onClick={() => addObjectNode(ec)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(ec));
              }}
              style={{
                padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'grab',
                background: '#334155', color: '#e2e8f0', fontSize: 13,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#334155')}
            >
              <div style={{ fontWeight: 500 }}>{ec.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {ec.eStructuralFeatures?.length || 0} features
              </div>
            </div>
          ))}
        </div>

        {/* ── Canvas ────────────────────────────────────────── */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            selectionMode={SelectionMode.Partial}
            colorMode="dark"
            nodeDragThreshold={5}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
              style: { stroke: '#6366f1', strokeWidth: 2 },
            }}
          >
            <Background color="#334155" gap={20} />
            <Controls />
            <MiniMap
              style={{ background: '#1e293b', border: '1px solid #334155' }}
              nodeColor="#6366f1"
              maskColor="rgba(15,23,42,0.7)"
            />
          </ReactFlow>
        </div>

        {/* ── Property Inspector ────────────────────────────── */}
        <div style={{
          width: 260, background: '#1e293b', borderLeft: '1px solid #334155',
          padding: 12, overflowY: 'auto', flexShrink: 0,
        }}>
          {!selectedNode && (
            <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 40 }}>
              Select a node to edit properties
            </div>
          )}

          {selectedNode && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {selectedNode.data.eClassName}
              </div>

              {/* Name */}
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Name</label>
                <input
                  value={selectedNode.data.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, label: val } }
                          : n,
                      ),
                    );
                    setSelectedNode((prev) =>
                      prev ? { ...prev, data: { ...prev.data, label: val } } : prev,
                    );
                  }}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #334155',
                    background: '#0f172a', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Attributes */}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 16 }}>
                Attributes
              </div>
              {Object.entries(selectedNode.data.attributes).map(([key, val]) => (
                <div key={key} className="form-field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: '#94a3b8' }}>{key}</label>
                  {typeof val === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={val as boolean}
                      onChange={(e) => updateAttribute(key, e.target.checked)}
                      style={{ accentColor: '#6366f1' }}
                    />
                  ) : typeof val === 'number' ? (
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => updateAttribute(key, Number(e.target.value))}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #334155',
                        background: '#0f172a', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) => updateAttribute(key, e.target.value)}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #334155',
                        background: '#0f172a', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                  )}
                </div>
              ))}

              {Object.keys(selectedNode.data.attributes).length === 0 && (
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  No attributes
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Export Output ──────────────────────────────────── */}
      {exportOutput && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: '#0f172a', borderTop: '1px solid #334155', maxHeight: '40vh', overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #334155' }}>
            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Export Output</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setExportOutput('')} style={{ color: '#94a3b8' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <pre style={{
            padding: 16, fontSize: 12, color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
          }}>
            {exportOutput}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ModelEditor wrapper                                                */
/* ------------------------------------------------------------------ */

export default function ModelEditor() {
  return (
    <ReactFlowProvider>
      <ModelEditorInner />
    </ReactFlowProvider>
  );
}
