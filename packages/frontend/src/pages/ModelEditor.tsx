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
  getGraphicalSpecs,
  Metamodel,
  M1Model,
  GraphicalSpec,
} from '../api/client';
import { Download, Save } from '../components/icons';
import ErrorPanel from '../components/feedback/ErrorPanel';
import type { ShapeStyle, EdgeStyle, Mapping, SpecData } from '../components/spec-diagram/types';

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
interface M1ObjectNodeData extends Record<string, unknown> {
  eClassName: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
  label: string;
  eClass: EClassData;
}

type M1ObjectNode = Node<M1ObjectNodeData>;

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
            eType: { eClass: 'ecore:EDataType', name: attr.eType || attr.type || 'EString' },
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

function ModelEditorInner(props: { projectId?: string; metamodelId?: string; modelId?: string }) {
  const params = useParams<{ pid: string; mmid: string; modelId: string }>();
  const pid = props.projectId || params.pid;
  const mmid = props.metamodelId || params.mmid;
  const modelId = props.modelId || params.modelId;

  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [m1Model, setM1Model] = useState<M1Model | null>(null);
  const [epkg, setEpkg] = useState<EPackage | null>(null);
  const [specMappings, setSpecMappings] = useState<Map<string, ShapeStyle>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | ''>('');
  const [selectedNode, setSelectedNode] = useState<M1ObjectNode | null>(null);
  const [exportOutput, setExportOutput] = useState('');

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef('');

  const [nodes, setNodes, onNodesChange] = useNodesState<M1ObjectNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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

        /* Load graphical spec (Sirius-like) for visual rendering */
        try {
          const specs = await getGraphicalSpecs(mmid);
          if (specs.length > 0) {
            const specJson = JSON.parse(specs[0].spec || '{}') as SpecData;
            const mappingMap = new Map<string, ShapeStyle>();
            for (const layer of specJson.layers || []) {
              for (const mapping of layer.mappings || []) {
                mappingMap.set(mapping.domainClass, mapping.style);
              }
            }
            setSpecMappings(mappingMap);
          }
        } catch {
          // No spec available — use default styling
        }

        /* Deserialize saved content */
        if (m.content) {
          try {
            const saved = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
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

    /* Apply Sirius graphical spec style if available */
    const specStyle = specMappings.get(eClass.name);
    const nodeStyle = specStyle
      ? {
          background: specStyle.color,
          border: `${specStyle.borderSize}px solid ${specStyle.borderColor}`,
          borderRadius: specStyle.shape === 'ellipse' ? '50%' : specStyle.shape === 'diamond' ? 4 : 8,
          padding: '12px 16px',
          color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
          fontSize: 13,
          minWidth: 160,
        }
      : {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          color: 'var(--text)',
          fontSize: 13,
          minWidth: 160,
        };

    const newNode: M1ObjectNode = {
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
      style: nodeStyle,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes, specMappings]);

  /* Connect edges */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
      }, eds));
    },
    [setEdges],
  );

  /* Selection */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: M1ObjectNode) => {
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
    return <ErrorPanel title="Error" message={error} compact />;
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
          return ref.containment !== undefined || ref.eOpposite !== undefined;
        })
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* ── Toolbar ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <Link to={`/projects/${pid}/metamodels/${mmid}/models`} style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}>
          ← Models
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          {m1Model?.name || 'Model Editor'}
        </span>
        <div style={{ flex: 1 }} />
        {saveStatus === 'saved' && (
          <span style={{ color: 'var(--success)', fontSize: 12 }}>Saved</span>
        )}
        {saveStatus === 'unsaved' && (
          <span style={{ color: 'var(--warning)', fontSize: 12 }}>Unsaved changes</span>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('json')}>
          <Download size={14} /> JSON
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('xmi')}>
          <Download size={14} /> XMI
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : <><Save size={14} /> Save</>}
        </button>
      </div>

      {error && (
        <div style={{ padding: '6px 20px' }}>
          <ErrorPanel title="Error" message={error} compact />
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Palette ───────────────────────────────────────── */}
        <div style={{
          width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)',
          padding: 12, overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Palette
            {specMappings.size > 0 && (
              <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 6, color: 'var(--primary)', textTransform: 'none' }}>
                ● Sirius
              </span>
            )}
          </div>
          {paletteItems.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
                background: 'var(--border)', color: 'var(--text)', fontSize: 13,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--border)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {specMappings.has(ec.name) && (
                  <span style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: specMappings.get(ec.name)!.color,
                    border: `1px solid ${specMappings.get(ec.name)!.borderColor}`,
                  }} />
                )}
                <span style={{ fontWeight: 500 }}>{ec.name}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
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
              markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
              style: { stroke: 'var(--primary)', strokeWidth: 2 },
            }}
          >
            <Background color="var(--border)" gap={20} />
            <Controls />
            <MiniMap
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              nodeColor="var(--primary)"
              maskColor="rgba(15,23,42,0.7)"
            />
          </ReactFlow>
        </div>

        {/* ── Property Inspector ────────────────────────────── */}
        <div style={{
          width: 260, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          padding: 12, overflowY: 'auto', flexShrink: 0,
        }}>
          {!selectedNode && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
              Select a node to edit properties
            </div>
          )}

          {selectedNode && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {selectedNode.data.eClassName}
              </div>

              {/* Name */}
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Name</label>
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
                    width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Attributes */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 16 }}>
                Attributes
              </div>
              {Object.entries(selectedNode.data.attributes).map(([key, val]) => (
                <div key={key} className="form-field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{key}</label>
                  {typeof val === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={val as boolean}
                      onChange={(e) => updateAttribute(key, e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                  ) : typeof val === 'number' ? (
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => updateAttribute(key, Number(e.target.value))}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) => updateAttribute(key, e.target.value)}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                  )}
                </div>
              ))}

              {Object.keys(selectedNode.data.attributes).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
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
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--bg)', borderTop: '1px solid var(--border)', maxHeight: '40%', overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>Export Output</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setExportOutput('')} style={{ color: 'var(--text-secondary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <pre style={{
            padding: 16, fontSize: 12, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace",
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

interface ModelEditorProps {
  projectId?: string;
  metamodelId?: string;
  modelId?: string;
}

export default function ModelEditor(props: ModelEditorProps) {
  return (
    <ReactFlowProvider>
      <ModelEditorInner {...props} />
    </ReactFlowProvider>
  );
}
