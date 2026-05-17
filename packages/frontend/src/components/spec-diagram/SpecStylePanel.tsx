/**
 * @emf-webapp/frontend — SpecStylePanel
 *
 * Right panel for editing visual styles of a selected mapping in the
 * spec editor canvas. Supports node, container, and edge selections.
 */
import React from 'react';
import type {
  NodeMapping,
  EdgeMapping,
  NodeStyle,
  EdgeStyleSpec,
  ShapeType,
  LineStyleType,
  LabelPosition,
  DecorationArrow,
  RoutingStyle,
} from './types';
import { ConditionalStyleEditor } from '../spec-editor/ConditionalStyleEditor';

/* ------------------------------------------------------------------ */
/*  Color Presets                                                       */
/* ------------------------------------------------------------------ */

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#64748b',
];

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

export interface SpecStylePanelProps {
  selectedType: 'node' | 'container' | 'edge' | null;
  nodeMapping?: NodeMapping;
  edgeMapping?: EdgeMapping;
  onUpdateNodeMapping?: (patch: Partial<NodeMapping>) => void;
  onUpdateEdgeMapping?: (patch: Partial<EdgeMapping>) => void;
}

/* ------------------------------------------------------------------ */
/*  Main Panel                                                         */
/* ------------------------------------------------------------------ */

export default function SpecStylePanel({
  selectedType,
  nodeMapping,
  edgeMapping,
  onUpdateNodeMapping,
  onUpdateEdgeMapping,
}: SpecStylePanelProps) {
  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>Style Editor</div>

      {/* Content */}
      <div style={contentStyle}>
        {!selectedType && <EmptyState />}

        {(selectedType === 'node' || selectedType === 'container') &&
          nodeMapping &&
          onUpdateNodeMapping && (
            <NodeStyleEditor
              mapping={nodeMapping}
              onUpdate={onUpdateNodeMapping}
              isContainer={selectedType === 'container'}
            />
          )}

        {selectedType === 'edge' && edgeMapping && onUpdateEdgeMapping && (
          <EdgeStyleEditor
            mapping={edgeMapping}
            onUpdate={onUpdateEdgeMapping}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                         */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 13 }}>
      <svg
        width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 12 }}
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
      <p style={{ margin: 0, opacity: 0.6 }}>
        Select a node or edge<br />on the canvas to edit its style
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Node / Container Style Editor                                       */
/* ------------------------------------------------------------------ */

function NodeStyleEditor({
  mapping,
  onUpdate,
  isContainer,
}: {
  mapping: NodeMapping;
  onUpdate: (patch: Partial<NodeMapping>) => void;
  isContainer: boolean;
}) {
  const style = mapping.defaultStyle;

  const updateStyle = (patch: Partial<NodeStyle>) => {
    onUpdate({ defaultStyle: { ...style, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 2,
          background: style.color,
          border: `2px solid ${style.borderColor}`,
        }} />
        {mapping.domainClass || (isContainer ? 'Container' : 'Node')}
      </div>

      {/* SHAPE */}
      <Section title="SHAPE">
        <select
          value={style.shape}
          onChange={(e) => updateStyle({ shape: e.target.value as ShapeType })}
          style={inputStyle}
          aria-label="Shape type"
        >
          <option value="rectangle">Rectangle</option>
          <option value="rounded-rectangle">Rounded Rectangle</option>
          <option value="ellipse">Ellipse</option>
          <option value="diamond">Diamond</option>
          <option value="note">Note</option>
          <option value="image">Image</option>
        </select>
      </Section>

      {/* COLORS */}
      <Section title="COLORS">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ColorRow
            label="Fill"
            value={style.color}
            onChange={(v) => updateStyle({ color: v })}
          />
          <ColorRow
            label="Border"
            value={style.borderColor}
            onChange={(v) => updateStyle({ borderColor: v })}
          />
          <ColorRow
            label="Label"
            value={style.labelColor}
            onChange={(v) => updateStyle({ labelColor: v })}
          />
        </div>
      </Section>

      {/* BORDER */}
      <Section title="BORDER">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabelStyle}>Size</label>
            <input
              type="number"
              min={0}
              max={10}
              value={style.borderSize}
              onChange={(e) => updateStyle({ borderSize: Number(e.target.value) })}
              style={inputStyleNumber}
              aria-label="Border size"
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={fieldLabelStyle}>Line Style</label>
            <select
              value={style.borderLineStyle}
              onChange={(e) => updateStyle({ borderLineStyle: e.target.value as LineStyleType })}
              style={inputStyle}
              aria-label="Border line style"
            >
              <option value="solid">Solid</option>
              <option value="dash">Dash</option>
              <option value="dot">Dot</option>
              <option value="dash-dot">Dash-Dot</option>
            </select>
          </div>
        </div>
      </Section>

      {/* LABEL */}
      <Section title="LABEL">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <label style={fieldLabelStyle}>Expression</label>
            <input
              value={style.labelExpression}
              onChange={(e) => updateStyle({ labelExpression: e.target.value })}
              placeholder="e.g. self.name"
              style={inputStyle}
              aria-label="Label expression"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabelStyle}>Position</label>
              <select
                value={style.labelPosition}
                onChange={(e) => updateStyle({ labelPosition: e.target.value as LabelPosition })}
                style={inputStyle}
                aria-label="Label position"
              >
                <option value="inside">Inside</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="border">Border</option>
              </select>
            </div>
            <div style={{ width: 60 }}>
              <label style={fieldLabelStyle}>Size</label>
              <input
                type="number"
                min={8}
                max={24}
                value={style.labelSize}
                onChange={(e) => updateStyle({ labelSize: Number(e.target.value) })}
                style={inputStyleNumber}
                aria-label="Label size"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={style.labelBold}
                onChange={(e) => updateStyle({ labelBold: e.target.checked })}
              />
              <strong>B</strong>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={style.labelItalic}
                onChange={(e) => updateStyle({ labelItalic: e.target.checked })}
              />
              <em>I</em>
            </label>
          </div>
        </div>
      </Section>

      {/* DIMENSIONS */}
      <Section title="DIMENSIONS">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabelStyle}>Width</label>
            <input
              type="number"
              min={0}
              value={style.width ?? ''}
              onChange={(e) => updateStyle({ width: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="auto"
              style={inputStyleNumber}
              aria-label="Width"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabelStyle}>Height</label>
            <input
              type="number"
              min={0}
              value={style.height ?? ''}
              onChange={(e) => updateStyle({ height: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="auto"
              style={inputStyleNumber}
              aria-label="Height"
            />
          </div>
        </div>
      </Section>

      {/* ADVANCED */}
      <Section title="ADVANCED">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <label style={fieldLabelStyle}>Tooltip Expression</label>
            <input
              value={style.tooltipExpression || ''}
              onChange={(e) => updateStyle({ tooltipExpression: e.target.value || undefined })}
              placeholder="Optional tooltip"
              style={inputStyle}
              aria-label="Tooltip expression"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={style.showIcon}
              onChange={(e) => updateStyle({ showIcon: e.target.checked })}
            />
            Show Icon
          </label>
        </div>
      </Section>

      {/* CONDITIONAL STYLES */}
      <Section title="CONDITIONAL STYLES">
        <ConditionalStyleEditor
          conditionalStyles={mapping.conditionalStyles}
          onUpdate={(styles) => onUpdate({ conditionalStyles: styles })}
          styleType="node"
        />
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edge Style Editor                                                   */
/* ------------------------------------------------------------------ */

function EdgeStyleEditor({
  mapping,
  onUpdate,
}: {
  mapping: EdgeMapping;
  onUpdate: (patch: Partial<EdgeMapping>) => void;
}) {
  const style = mapping.defaultStyle;

  const updateStyle = (patch: Partial<EdgeStyleSpec>) => {
    onUpdate({ defaultStyle: { ...style, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>↔</span>
        {mapping.id}
      </div>

      {/* LINE */}
      <Section title="LINE">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 2 }}>
            <label style={fieldLabelStyle}>Style</label>
            <select
              value={style.lineStyle}
              onChange={(e) => updateStyle({ lineStyle: e.target.value as LineStyleType })}
              style={inputStyle}
              aria-label="Line style"
            >
              <option value="solid">─ Solid</option>
              <option value="dash">┅ Dash</option>
              <option value="dot">┈ Dot</option>
              <option value="dash-dot">┅┈ Dash-Dot</option>
            </select>
          </div>
          <div style={{ width: 60 }}>
            <label style={fieldLabelStyle}>Width</label>
            <input
              type="number"
              min={1}
              max={10}
              value={style.lineWidth}
              onChange={(e) => updateStyle({ lineWidth: Number(e.target.value) })}
              style={inputStyleNumber}
              aria-label="Line width"
            />
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <ColorRow
            label="Color"
            value={style.color}
            onChange={(v) => updateStyle({ color: v })}
          />
        </div>
      </Section>

      {/* ROUTING */}
      <Section title="ROUTING">
        <select
          value={style.routingStyle}
          onChange={(e) => updateStyle({ routingStyle: e.target.value as RoutingStyle })}
          style={inputStyle}
          aria-label="Routing style"
        >
          <option value="straight">Straight</option>
          <option value="manhattan">Manhattan</option>
          <option value="tree">Tree</option>
        </select>
      </Section>

      {/* DECORATIONS */}
      <Section title="DECORATIONS">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabelStyle}>Source</label>
            <select
              value={style.sourceDecoration}
              onChange={(e) => updateStyle({ sourceDecoration: e.target.value as DecorationArrow })}
              style={inputStyle}
              aria-label="Source decoration"
            >
              <option value="none">None</option>
              <option value="arrow">▷ Arrow</option>
              <option value="open-arrow">▹ Open Arrow</option>
              <option value="diamond">◇ Diamond</option>
              <option value="filled-diamond">◆ Filled Diamond</option>
              <option value="triangle">△ Triangle</option>
              <option value="filled-triangle">▲ Filled Triangle</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabelStyle}>Target</label>
            <select
              value={style.targetDecoration}
              onChange={(e) => updateStyle({ targetDecoration: e.target.value as DecorationArrow })}
              style={inputStyle}
              aria-label="Target decoration"
            >
              <option value="none">None</option>
              <option value="arrow">▷ Arrow</option>
              <option value="open-arrow">▹ Open Arrow</option>
              <option value="diamond">◇ Diamond</option>
              <option value="filled-diamond">◆ Filled Diamond</option>
              <option value="triangle">△ Triangle</option>
              <option value="filled-triangle">▲ Filled Triangle</option>
            </select>
          </div>
        </div>
      </Section>

      {/* LABELS */}
      <Section title="LABELS">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <label style={fieldLabelStyle}>Center Label</label>
            <input
              value={style.centerLabelExpression || ''}
              onChange={(e) => updateStyle({ centerLabelExpression: e.target.value || undefined })}
              placeholder="e.g. self.name"
              style={inputStyle}
              aria-label="Center label expression"
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>Begin Label</label>
            <input
              value={style.beginLabelExpression || ''}
              onChange={(e) => updateStyle({ beginLabelExpression: e.target.value || undefined })}
              placeholder="Optional"
              style={inputStyle}
              aria-label="Begin label expression"
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>End Label</label>
            <input
              value={style.endLabelExpression || ''}
              onChange={(e) => updateStyle({ endLabelExpression: e.target.value || undefined })}
              placeholder="Optional"
              style={inputStyle}
              aria-label="End label expression"
            />
          </div>
        </div>
      </Section>

      {/* CONDITIONAL STYLES */}
      <Section title="CONDITIONAL STYLES">
        <ConditionalStyleEditor
          conditionalStyles={mapping.conditionalStyles}
          onUpdate={(styles) => onUpdate({ conditionalStyles: styles })}
          styleType="edge"
        />
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared Components                                                   */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={sectionHeaderStyle}>{title}</div>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 26, height: 20, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }}
        aria-label={`${label} color`}
      />
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 40 }}>{label}</span>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1 }}>
        {COLORS.map((c) => (
          <div
            key={c}
            onClick={() => onChange(c)}
            role="button"
            tabIndex={0}
            aria-label={`Set ${label.toLowerCase()} color to ${c}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onChange(c); }}
            style={{
              width: 14, height: 14, borderRadius: 2, background: c, cursor: 'pointer',
              border: value === c ? '2px solid var(--primary)' : '1px solid var(--border)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const panelStyle: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--surface)',
  borderLeft: '1px solid var(--border)',
  height: '100%',
};

const headerStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 14,
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 3,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  borderRadius: 5,
  border: '1px solid var(--border)',
  fontSize: 12,
  fontFamily: 'inherit',
  background: 'var(--bg)',
  color: 'var(--text)',
  boxSizing: 'border-box',
};

const inputStyleNumber: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
};
