/**
 * NodeStyleEditor — Full style editor for NodeMapping.defaultStyle
 *
 * Sections:
 * - Shape selector (visual grid)
 * - Colors (fill, border, label)
 * - Border (size, line style)
 * - Dimensions (width, height)
 * - Label (expression, position, size, bold, italic)
 * - Icon
 */
import React from 'react';
import type { NodeStyle, ShapeType, LineStyleType, LabelPosition } from '../../spec-diagram/types';
import {
  FormField,
  ColorPicker,
  Slider,
  Toggle,
  Select,
  NumberInput,
  TextInput,
  SectionDivider,
} from '../shared/FormControls';

interface NodeStyleEditorProps {
  style: NodeStyle;
  onChange: (patch: Partial<NodeStyle>) => void;
}

const SHAPES: { value: ShapeType; label: string; icon: string }[] = [
  { value: 'rectangle', label: 'Rectangle', icon: '▬' },
  { value: 'rounded-rectangle', label: 'Rounded', icon: '▢' },
  { value: 'ellipse', label: 'Ellipse', icon: '⬭' },
  { value: 'diamond', label: 'Diamond', icon: '◇' },
  { value: 'note', label: 'Note', icon: '🗒' },
  { value: 'image', label: 'Image', icon: '🖼' },
];

const LINE_STYLES: { value: LineStyleType; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dash', label: 'Dashed' },
  { value: 'dot', label: 'Dotted' },
  { value: 'dash-dot', label: 'Dash-Dot' },
];

const LABEL_POSITIONS: { value: LabelPosition; label: string }[] = [
  { value: 'inside', label: 'Inside' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'border', label: 'Border' },
];

export function NodeStyleEditor({ style, onChange }: NodeStyleEditorProps) {
  return (
    <div style={styles.container}>
      {/* ─── Shape ─────────────────────────────────────────── */}
      <SectionDivider label="Shape" />
      <div style={styles.shapeGrid}>
        {SHAPES.map((shape) => (
          <button
            key={shape.value}
            onClick={() => onChange({ shape: shape.value })}
            title={shape.label}
            style={{
              ...styles.shapeBtn,
              ...(style.shape === shape.value ? styles.shapeBtnActive : {}),
            }}
          >
            <span style={styles.shapeIcon}>{shape.icon}</span>
            <span style={styles.shapeLabel}>{shape.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Colors ────────────────────────────────────────── */}
      <SectionDivider label="Colors" />
      <FormField label="Fill">
        <ColorPicker value={style.color} onChange={(v) => onChange({ color: v })} />
      </FormField>
      <FormField label="Border">
        <ColorPicker value={style.borderColor} onChange={(v) => onChange({ borderColor: v })} />
      </FormField>
      <FormField label="Label">
        <ColorPicker value={style.labelColor} onChange={(v) => onChange({ labelColor: v })} />
      </FormField>

      {/* ─── Border ────────────────────────────────────────── */}
      <SectionDivider label="Border" />
      <FormField label="Size">
        <Slider value={style.borderSize} onChange={(v) => onChange({ borderSize: v })} min={0} max={8} step={1} suffix="px" />
      </FormField>
      <FormField label="Style">
        <Select
          value={style.borderLineStyle}
          onChange={(v) => onChange({ borderLineStyle: v as LineStyleType })}
          options={LINE_STYLES}
        />
      </FormField>

      {/* ─── Dimensions ────────────────────────────────────── */}
      <SectionDivider label="Dimensions" />
      <div style={styles.row}>
        <FormField label="Width">
          <NumberInput value={style.width || 120} onChange={(v) => onChange({ width: v })} min={40} max={400} suffix="px" />
        </FormField>
        <FormField label="Height">
          <NumberInput value={style.height || 60} onChange={(v) => onChange({ height: v })} min={20} max={300} suffix="px" />
        </FormField>
      </div>

      {/* ─── Label ─────────────────────────────────────────── */}
      <SectionDivider label="Label" />
      <FormField label="Expression">
        <TextInput
          value={style.labelExpression}
          onChange={(v) => onChange({ labelExpression: v })}
          placeholder="self.name"
          monospace
        />
      </FormField>
      <FormField label="Position">
        <Select
          value={style.labelPosition}
          onChange={(v) => onChange({ labelPosition: v as LabelPosition })}
          options={LABEL_POSITIONS}
        />
      </FormField>
      <FormField label="Size">
        <Slider value={style.labelSize} onChange={(v) => onChange({ labelSize: v })} min={8} max={24} step={1} suffix="px" />
      </FormField>
      <div style={styles.row}>
        <Toggle value={style.labelBold} onChange={(v) => onChange({ labelBold: v })} label="Bold" />
        <Toggle value={style.labelItalic} onChange={(v) => onChange({ labelItalic: v })} label="Italic" />
      </div>

      {/* ─── Icon ──────────────────────────────────────────── */}
      <SectionDivider label="Icon" />
      <Toggle value={style.showIcon} onChange={(v) => onChange({ showIcon: v })} label="Show icon" />
      {style.showIcon && (
        <FormField label="Icon Path">
          <TextInput
            value={style.iconPath || ''}
            onChange={(v) => onChange({ iconPath: v })}
            placeholder="/icons/class.svg"
          />
        </FormField>
      )}

      {/* ─── Tooltip ───────────────────────────────────────── */}
      <SectionDivider label="Tooltip" />
      <FormField label="Expression">
        <TextInput
          value={style.tooltipExpression || ''}
          onChange={(v) => onChange({ tooltipExpression: v || undefined })}
          placeholder="self.name + ' : ' + self.eClass().name"
          monospace
        />
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
  shapeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  },
  shapeBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 4px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    background: 'var(--bg-input, var(--background))',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  shapeBtnActive: {
    borderColor: 'var(--primary)',
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.12))',
  },
  shapeIcon: {
    fontSize: '18px',
    lineHeight: '20px',
  },
  shapeLabel: {
    fontSize: '9px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  row: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
};

export default NodeStyleEditor;
