/**
 * @emf-webapp/frontend — SpecStylePanel
 *
 * Panel lateral derecho para editar los estilos visuales de un mapping
 * seleccionado en el canvas de especificación gráfica.
 */
import type { ShapeStyle, EdgeStyle } from './types';

/* ------------------------------------------------------------------ */
/*  Color Presets                                                       */
/* ------------------------------------------------------------------ */

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#64748b',
];

/* ------------------------------------------------------------------ */
/*  Shape Style Section                                                 */
/* ------------------------------------------------------------------ */

function ShapeStyleSection({
  style,
  onChange,
}: {
  style: ShapeStyle;
  onChange: (patch: Partial<ShapeStyle>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Shape */}
      <div>
        <label style={labelStyle}>Shape</label>
        <select
          value={style.shape}
          onChange={(e) => onChange({ shape: e.target.value as ShapeStyle['shape'] })}
          style={inputStyle}
        >
          <option value="rectangle">Rectangle</option>
          <option value="ellipse">Ellipse</option>
          <option value="diamond">Diamond</option>
        </select>
      </div>

      {/* Label Position */}
      <div>
        <label style={labelStyle}>Label Position</label>
        <select
          value={style.labelPosition}
          onChange={(e) => onChange({ labelPosition: e.target.value as ShapeStyle['labelPosition'] })}
          style={inputStyle}
        >
          <option value="inside">Inside</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </div>

      {/* Fill Color */}
      <div>
        <label style={labelStyle}>Fill Color</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="color"
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
            style={{ width: 28, height: 22, border: 'none', padding: 0, cursor: 'pointer' }}
          />
          {COLORS.map((c) => (
            <div
              key={c}
              onClick={() => onChange({ color: c })}
              style={{
                width: 18, height: 18, borderRadius: 3, background: c, cursor: 'pointer',
                border: style.color === c ? '2px solid var(--primary)' : '1px solid var(--border)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Border Color */}
      <div>
        <label style={labelStyle}>Border Color</label>
        <input
          type="color"
          value={style.borderColor}
          onChange={(e) => onChange({ borderColor: e.target.value })}
          style={{ width: 28, height: 22, border: 'none', padding: 0, cursor: 'pointer' }}
        />
      </div>

      {/* Border Size */}
      <div>
        <label style={labelStyle}>Border Size</label>
        <input
          type="number"
          min={0}
          max={10}
          value={style.borderSize}
          onChange={(e) => onChange({ borderSize: Number(e.target.value) })}
          style={inputStyleNumber}
        />
      </div>

      {/* Label Expression */}
      <div>
        <label style={labelStyle}>Label Expression</label>
        <input
          value={style.labelExpression}
          onChange={(e) => onChange({ labelExpression: e.target.value })}
          placeholder="e.g. self.name"
          style={inputStyle}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edge Style Section                                                  */
/* ------------------------------------------------------------------ */

function EdgeStyleSection({
  style,
  onChange,
}: {
  style: EdgeStyle;
  onChange: (patch: Partial<EdgeStyle>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Line Style */}
      <div>
        <label style={labelStyle}>Line Style</label>
        <select
          value={style.lineStyle}
          onChange={(e) => onChange({ lineStyle: e.target.value as EdgeStyle['lineStyle'] })}
          style={inputStyle}
        >
          <option value="solid">─ Solid</option>
          <option value="dash">┅ Dash</option>
          <option value="dot">┈ Dot</option>
          <option value="dash-dot">┅ Dot</option>
        </select>
      </div>

      {/* Source Decoration */}
      <div>
        <label style={labelStyle}>Source Decoration</label>
        <select
          value={style.sourceDecoration}
          onChange={(e) => onChange({ sourceDecoration: e.target.value as EdgeStyle['sourceDecoration'] })}
          style={inputStyle}
        >
          <option value="none">None</option>
          <option value="arrow">▷ Arrow</option>
          <option value="diamond">◇ Diamond</option>
          <option value="filled-diamond">◆ Filled Diamond</option>
        </select>
      </div>

      {/* Target Decoration */}
      <div>
        <label style={labelStyle}>Target Decoration</label>
        <select
          value={style.targetDecoration}
          onChange={(e) => onChange({ targetDecoration: e.target.value as EdgeStyle['targetDecoration'] })}
          style={inputStyle}
        >
          <option value="none">None</option>
          <option value="arrow">▷ Arrow</option>
          <option value="diamond">◇ Diamond</option>
          <option value="filled-diamond">◆ Filled Diamond</option>
        </select>
      </div>

      {/* Color */}
      <div>
        <label style={labelStyle}>Color</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="color"
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
            style={{ width: 28, height: 22, border: 'none', padding: 0, cursor: 'pointer' }}
          />
          {COLORS.map((c) => (
            <div
              key={c}
              onClick={() => onChange({ color: c })}
              style={{
                width: 18, height: 18, borderRadius: 3, background: c, cursor: 'pointer',
                border: style.color === c ? '2px solid var(--primary)' : '1px solid var(--border)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Label Expression */}
      <div>
        <label style={labelStyle}>Label Expression</label>
        <input
          value={style.labelExpression}
          onChange={(e) => onChange({ labelExpression: e.target.value })}
          placeholder="e.g. self.name"
          style={inputStyle}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                         */
/* ------------------------------------------------------------------ */

function NoSelection() {
  return (
    <div style={{
      textAlign: 'center', color: 'var(--text-muted)',
      padding: 40, fontSize: 13,
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 12 }}>
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
      <p style={{ margin: 0, opacity: 0.6 }}>
        Select a node or edge<br />on the canvas to edit its style
      </p>
    </div>
  );
}

function EdgeInfo({ edge }: { edge: { source: string; target: string; sourceMapping: string; targetMapping: string } }) {
  return (
    <div style={{
      fontSize: 11, color: 'var(--text-secondary)',
      background: 'var(--bg)', padding: '6px 8px', borderRadius: 6,
      marginBottom: 12,
    }}>
      <div><strong>Source:</strong> {edge.sourceMapping || edge.source}</div>
      <div><strong>Target:</strong> {edge.targetMapping || edge.target}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Panel                                                         */
/* ------------------------------------------------------------------ */

export default function SpecStylePanel({
  selectionType,
  selectionLabel,
  shapeStyle,
  edgeStyle,
  edgeInfo,
  onShapeStyleChange,
  onEdgeStyleChange,
}: {
  selectionType: 'node' | 'edge' | null;
  selectionLabel?: string;
  shapeStyle?: ShapeStyle;
  edgeStyle?: EdgeStyle;
  edgeInfo?: { source: string; target: string; sourceMapping: string; targetMapping: string };
  onShapeStyleChange: (patch: Partial<ShapeStyle>) => void;
  onEdgeStyleChange: (patch: Partial<EdgeStyle>) => void;
}) {
  return (
    <div style={{
      width: 280, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        fontSize: 12, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
      }}>
        Style Editor
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {!selectionType && <NoSelection />}

        {selectionType === 'node' && shapeStyle && (
          <div>
            <div style={{
              fontSize: 13, fontWeight: 600, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: 2,
                background: shapeStyle.color,
                border: `2px solid ${shapeStyle.borderColor}`,
              }} />
              {selectionLabel || 'Node'}
            </div>
            <ShapeStyleSection style={shapeStyle} onChange={onShapeStyleChange} />
          </div>
        )}

        {selectionType === 'edge' && edgeStyle && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              🔗 {selectionLabel || 'Edge'}
            </div>
            {edgeInfo && <EdgeInfo edge={edgeInfo} />}
            <EdgeStyleSection style={edgeStyle} onChange={onEdgeStyleChange} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared Styles                                                       */
/* ------------------------------------------------------------------ */

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 12,
  fontFamily: 'inherit',
  background: 'var(--bg)',
  color: 'var(--text)',
  boxSizing: 'border-box',
};

const inputStyleNumber: React.CSSProperties = {
  ...inputStyle,
  width: 80,
};
