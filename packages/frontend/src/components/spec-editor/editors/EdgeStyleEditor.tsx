/**
 * EdgeStyleEditor — Full style editor for EdgeMapping.defaultStyle
 *
 * Sections:
 * - Line (style, width, color)
 * - Routing
 * - Decorations (source, target)
 * - Labels (begin, center, end)
 */
import React from 'react';
import type { EdgeStyleSpec, LineStyleType, DecorationArrow, RoutingStyle } from '../../spec-diagram/types';
import {
  FormField,
  ColorPicker,
  Slider,
  Select,
  TextInput,
  SectionDivider,
} from '../shared/FormControls';

interface EdgeStyleEditorProps {
  style: EdgeStyleSpec;
  onChange: (patch: Partial<EdgeStyleSpec>) => void;
}

const LINE_STYLES: { value: LineStyleType; label: string }[] = [
  { value: 'solid', label: 'Solid ───' },
  { value: 'dash', label: 'Dashed - - -' },
  { value: 'dot', label: 'Dotted · · ·' },
  { value: 'dash-dot', label: 'Dash-Dot -·-·' },
];

const ROUTING_STYLES: { value: RoutingStyle; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'manhattan', label: 'Manhattan (orthogonal)' },
  { value: 'tree', label: 'Tree' },
];

const DECORATIONS: { value: DecorationArrow; label: string; preview: string }[] = [
  { value: 'none', label: 'None', preview: '───' },
  { value: 'arrow', label: 'Arrow', preview: '──▶' },
  { value: 'open-arrow', label: 'Open Arrow', preview: '──>' },
  { value: 'diamond', label: 'Diamond', preview: '──◇' },
  { value: 'filled-diamond', label: 'Filled Diamond', preview: '──◆' },
  { value: 'triangle', label: 'Triangle', preview: '──△' },
  { value: 'filled-triangle', label: 'Filled Triangle', preview: '──▲' },
];

export function EdgeStyleEditor({ style, onChange }: EdgeStyleEditorProps) {
  return (
    <div style={styles.container}>
      {/* ─── Line ──────────────────────────────────────────── */}
      <SectionDivider label="Line" />
      <FormField label="Style">
        <Select
          value={style.lineStyle}
          onChange={(v) => onChange({ lineStyle: v as LineStyleType })}
          options={LINE_STYLES}
        />
      </FormField>
      <FormField label="Width">
        <Slider value={style.lineWidth} onChange={(v) => onChange({ lineWidth: v })} min={1} max={8} step={1} suffix="px" />
      </FormField>
      <FormField label="Color">
        <ColorPicker value={style.color} onChange={(v) => onChange({ color: v })} />
      </FormField>

      {/* ─── Routing ───────────────────────────────────────── */}
      <SectionDivider label="Routing" />
      <div style={styles.routingGrid}>
        {ROUTING_STYLES.map((rs) => (
          <button
            key={rs.value}
            onClick={() => onChange({ routingStyle: rs.value })}
            style={{
              ...styles.routingBtn,
              borderColor: style.routingStyle === rs.value ? 'var(--primary)' : 'var(--border)',
              background: style.routingStyle === rs.value ? 'var(--primary-bg, rgba(99, 102, 241, 0.12))' : 'var(--bg-input, var(--background))',
              color: style.routingStyle === rs.value ? 'var(--primary)' : 'var(--text)',
            }}
            title={rs.label}
          >
            {rs.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* ─── Decorations ───────────────────────────────────── */}
      <SectionDivider label="Source Decoration" />
      <div style={styles.decoGrid}>
        {DECORATIONS.map((d) => (
          <button
            key={d.value}
            onClick={() => onChange({ sourceDecoration: d.value })}
            title={d.label}
            style={{
              ...styles.decoBtn,
              borderColor: style.sourceDecoration === d.value ? 'var(--primary)' : 'var(--border)',
              background: style.sourceDecoration === d.value ? 'var(--primary-bg, rgba(99, 102, 241, 0.12))' : 'var(--bg-input, var(--background))',
            }}
          >
            <span style={styles.decoPreview}>{d.preview}</span>
            <span style={styles.decoLabel}>{d.label}</span>
          </button>
        ))}
      </div>

      <SectionDivider label="Target Decoration" />
      <div style={styles.decoGrid}>
        {DECORATIONS.map((d) => (
          <button
            key={d.value}
            onClick={() => onChange({ targetDecoration: d.value })}
            title={d.label}
            style={{
              ...styles.decoBtn,
              borderColor: style.targetDecoration === d.value ? 'var(--primary)' : 'var(--border)',
              background: style.targetDecoration === d.value ? 'var(--primary-bg, rgba(99, 102, 241, 0.12))' : 'var(--bg-input, var(--background))',
            }}
          >
            <span style={styles.decoPreview}>{d.preview}</span>
            <span style={styles.decoLabel}>{d.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Labels ────────────────────────────────────────── */}
      <SectionDivider label="Labels" />
      <FormField label="Center Label">
        <TextInput
          value={style.centerLabelExpression || ''}
          onChange={(v) => onChange({ centerLabelExpression: v || undefined })}
          placeholder="self.name"
          monospace
        />
      </FormField>
      <FormField label="Begin Label">
        <TextInput
          value={style.beginLabelExpression || ''}
          onChange={(v) => onChange({ beginLabelExpression: v || undefined })}
          placeholder="(optional)"
          monospace
        />
      </FormField>
      <FormField label="End Label">
        <TextInput
          value={style.endLabelExpression || ''}
          onChange={(v) => onChange({ endLabelExpression: v || undefined })}
          placeholder="(optional)"
          monospace
        />
      </FormField>
      <FormField label="Label Color">
        <ColorPicker value={style.labelColor} onChange={(v) => onChange({ labelColor: v })} />
      </FormField>
      <FormField label="Label Size">
        <Slider value={style.labelSize} onChange={(v) => onChange({ labelSize: v })} min={8} max={18} step={1} suffix="px" />
      </FormField>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  routingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  },
  routingBtn: {
    padding: '8px 4px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    background: 'var(--bg-input, var(--background))',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text)',
    textAlign: 'center',
    transition: 'border-color 0.15s, background 0.15s',
  },
  routingBtnActive: {
    borderColor: 'var(--primary)',
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.12))',
    color: 'var(--primary)',
  },
  decoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '4px',
  },
  decoBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
    padding: '6px 4px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'var(--bg-input, var(--background))',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  decoBtnActive: {
    borderColor: 'var(--primary)',
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.12))',
  },
  decoPreview: {
    fontSize: '13px',
    lineHeight: '16px',
  },
  decoLabel: {
    fontSize: '8px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
};

export default EdgeStyleEditor;
