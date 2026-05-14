import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getMetamodel,
  getGraphicalSpec,
  getGraphicalSpecs,
  createGraphicalSpec,
  updateGraphicalSpec,
  deleteGraphicalSpec,
  Metamodel,
  GraphicalSpec,
} from '../api/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ShapeStyle {
  shape: 'rectangle' | 'ellipse' | 'diamond';
  color: string;
  borderColor: string;
  borderSize: number;
  labelExpression: string;
  labelPosition: 'inside' | 'top' | 'bottom';
}

interface EdgeStyle {
  lineStyle: 'solid' | 'dash' | 'dot' | 'dash-dot';
  sourceDecoration: 'none' | 'arrow' | 'diamond' | 'filled-diamond';
  targetDecoration: 'none' | 'arrow' | 'diamond' | 'filled-diamond';
  color: string;
  labelExpression: string;
}

interface Mapping {
  domainClass: string;
  semanticCandidatesExpression: string;
  style: ShapeStyle;
  edgeMappings: {
    domainClass: string;
    sourceMapping: string;
    targetMapping: string;
    style: EdgeStyle;
  }[];
}

interface Layer {
  name: string;
  default: boolean;
  mappings: Mapping[];
}

interface SpecData {
  name: string;
  domain: string;
  layers: Layer[];
}

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
/*  Color preset                                                       */
/* ------------------------------------------------------------------ */

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#64748b',
];

/* ------------------------------------------------------------------ */
/*  SpecEditor Page                                                    */
/* ------------------------------------------------------------------ */

export default function SpecEditor() {
  const { pid, mmid, specId } = useParams<{ pid: string; mmid: string; specId?: string }>();

  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [specs, setSpecs] = useState<GraphicalSpec[]>([]);
  const [activeSpec, setActiveSpec] = useState<GraphicalSpec | null>(null);
  const [specData, setSpecData] = useState<SpecData>(DEFAULT_SPEC);
  const [eclassNames, setEclassNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeMapping, setActiveMapping] = useState<{ layerIdx: number; mappingIdx: number } | null>(null);

  // ── Load ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      if (!mmid) return;
      setLoading(true);
      try {
        const [mm, sList] = await Promise.all([
          getMetamodel('/' + pid!, mmid),
          getGraphicalSpecs(mmid),
        ]);
        setMetamodel(mm);
        setSpecs(sList);

        // Extract EClass names from metamodel content
        const content = mm.content || {};
        const classifiers: { name: string; abstract?: boolean; interface?: boolean }[] =
          content.eClassifiers || [];
        setEclassNames(
          classifiers
            .filter((c) => !c.abstract && !c.interface)
            .map((c) => c.name),
        );

        // If specId provided, load that spec
        if (specId) {
          const spec = sList.find((s) => s.id === specId) ||
            await getGraphicalSpec(mmid, specId);
          setActiveSpec(spec);
          const parsed = JSON.parse(spec.spec || '{}');
          setSpecData({
            name: parsed.name || spec.name,
            domain: parsed.domain || '',
            layers: parsed.layers || DEFAULT_SPEC.layers,
          });
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mmid, specId]);

  // ── Save ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!mmid) return;
    setSaving(true);
    try {
      const specPayload = JSON.stringify(specData);
      if (activeSpec) {
        await updateGraphicalSpec(mmid, activeSpec.id, { spec: specPayload });
      } else {
        const created = await createGraphicalSpec(mmid, {
          name: specData.name || 'New Spec',
          spec: specPayload,
        });
        setActiveSpec(created);
      }
      setError('');
      // Refresh list
      const sList = await getGraphicalSpecs(mmid);
      setSpecs(sList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [mmid, activeSpec, specData]);

  // ── Add mapping ───────────────────────────────────────────────────

  const addMapping = useCallback((layerIdx: number, domainClass: string) => {
    setSpecData((prev) => {
      const layers = [...prev.layers];
      layers[layerIdx] = {
        ...layers[layerIdx],
        mappings: [...layers[layerIdx].mappings, defaultMapping(domainClass)],
      };
      return { ...prev, layers };
    });
  }, []);

  // ── Add edge mapping ──────────────────────────────────────────────

  const addEdgeMapping = useCallback((layerIdx: number, mappingIdx: number, refClass: string) => {
    setSpecData((prev) => {
      const layers = [...prev.layers];
      const mappings = [...layers[layerIdx].mappings];
      mappings[mappingIdx] = {
        ...mappings[mappingIdx],
        edgeMappings: [
          ...(mappings[mappingIdx].edgeMappings || []),
          {
            domainClass: refClass,
            sourceMapping: mappings[mappingIdx].domainClass,
            targetMapping: refClass,
            style: defaultEdgeStyle(),
          },
        ],
      };
      layers[layerIdx] = { ...layers[layerIdx], mappings };
      return { ...prev, layers };
    });
  }, []);

  // ── Delete spec ───────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    if (!mmid) return;
    if (!window.confirm('Delete this specification?')) return;
    try {
      await deleteGraphicalSpec(mmid, id);
      setSpecs((s) => s.filter((x) => x.id !== id));
      if (activeSpec?.id === id) {
        setActiveSpec(null);
        setSpecData(DEFAULT_SPEC);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [mmid, activeSpec]);

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
          <Link to={`/projects/${pid}`} className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </Link>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Graphical Syntax — {metamodel?.name}
            </h1>
            <p className="page-subtitle" style={{ marginTop: 2 }}>
              Sirius-like visual specification editor
            </p>
          </div>
        </div>
      </div>

      {error && <div className="msg msg-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {/* Spec Selector + Save */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={activeSpec?.id || ''}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              setActiveSpec(null);
              setSpecData(DEFAULT_SPEC);
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
            }
          }}
          style={{
            padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
            fontSize: '.8125rem', fontFamily: 'inherit', background: 'var(--surface)', minWidth: 200,
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
            padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
            fontSize: '.8125rem', fontFamily: 'inherit', background: 'var(--surface)', width: 200,
          }}
        />

        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Spec'}
        </button>

        {activeSpec && (
          <button
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--danger)' }}
            onClick={() => handleDelete(activeSpec.id)}
          >
            🗑️ Delete
          </button>
        )}
      </div>

      {/* Main layout: left = mappings config, right = preview */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Left: Configuration */}
        <div style={{ flex: 1, minWidth: 400 }}>
          {/* Domain */}
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <div className="form-field">
              <label>Domain URI</label>
              <input
                value={specData.domain}
                onChange={(e) => setSpecData((p) => ({ ...p, domain: e.target.value }))}
                placeholder="http://example.org/1.0"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', fontSize: '.8125rem',
                  fontFamily: 'inherit', background: 'var(--surface)',
                }}
              />
            </div>
          </div>

          {/* Layers */}
          {specData.layers.map((layer, li) => (
            <div key={li} className="card" style={{ marginBottom: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  value={layer.name}
                  onChange={(e) => {
                    setSpecData((prev) => {
                      const layers = [...prev.layers];
                      layers[li] = { ...layers[li], name: e.target.value };
                      return { ...prev, layers };
                    });
                  }}
                  placeholder="Layer name"
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    fontSize: '.8125rem', fontFamily: 'inherit', background: 'var(--surface)', flex: 1,
                  }}
                />
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
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
                  Default
                </label>
              </div>

              {/* Mappings */}
              {layer.mappings.map((mapping, mi) => (
                <div
                  key={mi}
                  style={{
                    background: 'var(--surface)', borderRadius: 8, padding: 12, marginBottom: 8,
                    border: activeMapping?.layerIdx === li && activeMapping?.mappingIdx === mi
                      ? '2px solid #6366f1' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveMapping({ layerIdx: li, mappingIdx: mi })}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{mapping.domainClass}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpecData((prev) => {
                          const layers = [...prev.layers];
                          layers[li] = {
                            ...layers[li],
                            mappings: layers[li].mappings.filter((_, i) => i !== mi),
                          };
                          return { ...prev, layers };
                        });
                      }}
                      style={{ color: '#ef4444' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#94a3b8' }}>Shape</label>
                      <select
                        value={mapping.style.shape}
                        onChange={(e) => {
                          const val = e.target.value as ShapeStyle['shape'];
                          setSpecData((prev) => {
                            const layers = [...prev.layers];
                            layers[li].mappings[mi].style.shape = val;
                            return { ...prev, layers };
                          });
                        }}
                        style={{
                          width: '100%', padding: '4px 6px', borderRadius: 4,
                          border: '1px solid var(--border)', fontSize: 12,
                          fontFamily: 'inherit', background: 'var(--surface)',
                        }}
                      >
                        <option value="rectangle">Rectangle</option>
                        <option value="ellipse">Ellipse</option>
                        <option value="diamond">Diamond</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#94a3b8' }}>Label Position</label>
                      <select
                        value={mapping.style.labelPosition}
                        onChange={(e) => {
                          const val = e.target.value as ShapeStyle['labelPosition'];
                          setSpecData((prev) => {
                            const layers = [...prev.layers];
                            layers[li].mappings[mi].style.labelPosition = val;
                            return { ...prev, layers };
                          });
                        }}
                        style={{
                          width: '100%', padding: '4px 6px', borderRadius: 4,
                          border: '1px solid var(--border)', fontSize: 12,
                          fontFamily: 'inherit', background: 'var(--surface)',
                        }}
                      >
                        <option value="inside">Inside</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#94a3b8' }}>Fill Color</label>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <input
                          type="color"
                          value={mapping.style.color}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSpecData((prev) => {
                              const layers = [...prev.layers];
                              layers[li].mappings[mi].style.color = val;
                              return { ...prev, layers };
                            });
                          }}
                          style={{ width: 32, height: 24, border: 'none', padding: 0, cursor: 'pointer' }}
                        />
                        {COLORS.map((c) => (
                          <div
                            key={c}
                            onClick={() => {
                              setSpecData((prev) => {
                                const layers = [...prev.layers];
                                layers[li].mappings[mi].style.color = c;
                                return { ...prev, layers };
                              });
                            }}
                            style={{
                              width: 18, height: 18, borderRadius: 3, background: c, cursor: 'pointer',
                              border: mapping.style.color === c ? '2px solid white' : '1px solid #334155',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#94a3b8' }}>Border Color</label>
                      <input
                        type="color"
                        value={mapping.style.borderColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecData((prev) => {
                            const layers = [...prev.layers];
                            layers[li].mappings[mi].style.borderColor = val;
                            return { ...prev, layers };
                          });
                        }}
                        style={{ width: 32, height: 24, border: 'none', padding: 0, cursor: 'pointer' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#94a3b8' }}>Border Size</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={mapping.style.borderSize}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSpecData((prev) => {
                            const layers = [...prev.layers];
                            layers[li].mappings[mi].style.borderSize = val;
                            return { ...prev, layers };
                          });
                        }}
                        style={{
                          width: '100%', padding: '4px 6px', borderRadius: 4,
                          border: '1px solid var(--border)', fontSize: 12,
                          fontFamily: 'inherit', background: 'var(--surface)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Edge Mappings */}
                  {(mapping.edgeMappings || []).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                        Edge Mappings ({mapping.edgeMappings.length})
                      </div>
                      {mapping.edgeMappings.map((edge, ei) => (
                        <div key={ei} style={{
                          background: '#0f172a', borderRadius: 6, padding: 8, marginBottom: 6,
                          border: '1px solid #334155',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{edge.domainClass}</span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setSpecData((prev) => {
                                  const layers = [...prev.layers];
                                  layers[li].mappings[mi].edgeMappings =
                                    layers[li].mappings[mi].edgeMappings.filter((_, i) => i !== ei);
                                  return { ...prev, layers };
                                });
                              }}
                              style={{ color: '#ef4444', fontSize: 11 }}
                            >
                              ✕
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                              value={edge.style.lineStyle}
                              onChange={(e) => {
                                const val = e.target.value as EdgeStyle['lineStyle'];
                                setSpecData((prev) => {
                                  const layers = [...prev.layers];
                                  layers[li].mappings[mi].edgeMappings[ei].style.lineStyle = val;
                                  return { ...prev, layers };
                                });
                              }}
                              style={{
                                padding: '3px 5px', borderRadius: 4, border: '1px solid #334155',
                                fontSize: 11, fontFamily: 'inherit', background: '#1e293b', color: '#e2e8f0',
                              }}
                            >
                              <option value="solid">─ Solid</option>
                              <option value="dash">┅ Dash</option>
                              <option value="dot">┈ Dot</option>
                              <option value="dash-dot">┅ Dot</option>
                            </select>
                            <input
                              type="color"
                              value={edge.style.color}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSpecData((prev) => {
                                  const layers = [...prev.layers];
                                  layers[li].mappings[mi].edgeMappings[ei].style.color = val;
                                  return { ...prev, layers };
                                });
                              }}
                              style={{ width: 24, height: 20, border: 'none', padding: 0, cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Add mapping button */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>Add mapping for:</span>
                {eclassNames.map((ec) => (
                  <button
                    key={ec}
                    className="btn btn-ghost btn-sm"
                    onClick={() => addMapping(li, ec)}
                    style={{ fontSize: 11 }}
                  >
                    + {ec}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Preview */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Preview
            </div>
            {specData.layers.flatMap((l) => l.mappings).map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', marginBottom: 6,
                borderRadius: 8, background: '#1e293b', border: `2px solid ${m.style.borderColor}`,
              }}>
                <div style={{
                  width: 32, height: 32,
                  borderRadius: m.style.shape === 'ellipse' ? '50%' : m.style.shape === 'diamond' ? '4px' : 6,
                  background: m.style.color,
                  border: `${m.style.borderSize}px solid ${m.style.borderColor}`,
                  transform: m.style.shape === 'diamond' ? 'rotate(45deg)' : 'none',
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.domainClass}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.style.shape} · {m.style.labelPosition}</div>
                  {(m.edgeMappings || []).length > 0 && (
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {m.edgeMappings.length} edge(s)
                    </div>
                  )}
                </div>
              </div>
            ))}
            {specData.layers.flatMap((l) => l.mappings).length === 0 && (
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: 24 }}>
                Add mappings from the left panel
              </div>
            )}
          </div>

          {/* Spec JSON (read-only) */}
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Spec JSON
            </div>
            <pre style={{
              background: '#0f172a', color: '#e2e8f0', padding: 8, borderRadius: 6,
              fontSize: 11, overflow: 'auto', maxHeight: 300, fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
            }}>
              {JSON.stringify(specData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
