/**
 * @emf-webapp/frontend — ConditionalStyleEditor
 *
 * Edits a list of conditional style overrides for node or edge mappings.
 * Each conditional style has a predicate expression and a subset of style properties.
 */
import React, { useState } from 'react';
import type {
  ConditionalStyle,
  NodeStyle,
  EdgeStyleSpec,
  ShapeType,
  LineStyleType,
  LabelPosition,
  DecorationArrow,
  RoutingStyle,
} from '../spec-diagram/types';

export interface ConditionalStyleEditorProps {
  conditionalStyles: ConditionalStyle<any>[];
  onUpdate: (styles: ConditionalStyle<any>[]) => void;
  styleType: 'node' | 'edge';
}

export function ConditionalStyleEditor({
  conditionalStyles,
  onUpdate,
  styleType,
}: ConditionalStyleEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addStyle = () => {
    const newId = `cs_${Math.random().toString(36).slice(2, 10)}`;
    const newStyle: ConditionalStyle<any> = {
      id: newId,
      predicateExpression: '',
      style: {},
    };
    onUpdate([...conditionalStyles, newStyle]);
    setExpandedIds((prev) => new Set(prev).add(newId));
  };

  const removeStyle = (id: string) => {
    onUpdate(conditionalStyles.filter((s) => s.id !== id));
  };

  const updatePredicate = (id: string, expr: string) => {
    onUpdate(
      conditionalStyles.map((s) =>
        s.id === id ? { ...s, predicateExpression: expr } : s
      )
    );
  };

  const updateStyleProp = (id: string, prop: string, value: any) => {
    onUpdate(
      conditionalStyles.map((s) =>
        s.id === id ? { ...s, style: { ...s.style, [prop]: value } } : s
      )
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {conditionalStyles.map((cs, idx) => {
        const isExpanded = expandedIds.has(cs.id);
        return (
          <div
            key={cs.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text)',
              }}
              onClick={() => toggleExpanded(cs.id)}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-label={`Conditional style ${idx + 1}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggleExpanded(cs.id);
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.6 }}>
                {isExpanded ? '▼' : '▶'}
              </span>
              <span style={{ flex: 1, fontWeight: 500 }}>
                Condition {idx + 1}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeStyle(cs.id);
                }}
                style={btnRemoveStyle}
                aria-label={`Remove condition ${idx + 1}`}
                title="Remove"
              >
                ×
              </button>
            </div>

            {/* Body */}
            {isExpanded && (
              <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Predicate */}
                <div>
                  <label style={fieldLabelStyle}>Predicate Expression</label>
                  <input
                    value={cs.predicateExpression}
                    onChange={(e) => updatePredicate(cs.id, e.target.value)}
                    placeholder="e.g. self.isAbstract"
                    style={inputStyle}
                  />
                </div>

                {/* Style overrides */}
                {styleType === 'node' && (
                  <NodeStyleOverrides
                    style={cs.style}
                    onChange={(prop, val) => updateStyleProp(cs.id, prop, val)}
                  />
                )}
                {styleType === 'edge' && (
                  <EdgeStyleOverrides
                    style={cs.style}
                    onChange={(prop, val) => updateStyleProp(cs.id, prop, val)}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add button */}
      <button onClick={addStyle} style={btnAddStyle} aria-label="Add conditional style">
        + Add Condition
      </button>
    </div>
  );
}

/* ─── Node Style Overrides ─────────────────────────────────────────────────── */

function NodeStyleOverrides({
  style,
  onChange,
}: {
  style: Partial<NodeStyle>;
  onChange: (prop: string, value: any) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Shape</label>
          <select
            value={style.shape || ''}
            onChange={(e) => onChange('shape', e.target.value || undefined)}
            style={inputStyle}
          >
            <option value="">— inherit —</option>
            <option value="rectangle">Rectangle</option>
            <option value="rounded-rectangle">Rounded Rect</option>
            <option value="ellipse">Ellipse</option>
            <option value="diamond">Diamond</option>
            <option value="note">Note</option>
            <option value="image">Image</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Color</label>
          <input
            type="color"
            value={style.color || '#6366f1'}
            onChange={(e) => onChange('color', e.target.value)}
            style={colorInputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Border</label>
          <input
            type="color"
            value={style.borderColor || '#818cf8'}
            onChange={(e) => onChange('borderColor', e.target.value)}
            style={colorInputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Label</label>
          <input
            type="color"
            value={style.labelColor || '#ffffff'}
            onChange={(e) => onChange('labelColor', e.target.value)}
            style={colorInputStyle}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Border Size</label>
          <input
            type="number"
            min={0}
            max={10}
            value={style.borderSize ?? ''}
            onChange={(e) =>
              onChange('borderSize', e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="—"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Label Bold</label>
          <input
            type="checkbox"
            checked={style.labelBold ?? false}
            onChange={(e) => onChange('labelBold', e.target.checked)}
            style={{ marginTop: 4 }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Edge Style Overrides ─────────────────────────────────────────────────── */

function EdgeStyleOverrides({
  style,
  onChange,
}: {
  style: Partial<EdgeStyleSpec>;
  onChange: (prop: string, value: any) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Line Style</label>
          <select
            value={style.lineStyle || ''}
            onChange={(e) => onChange('lineStyle', e.target.value || undefined)}
            style={inputStyle}
          >
            <option value="">— inherit —</option>
            <option value="solid">Solid</option>
            <option value="dash">Dash</option>
            <option value="dot">Dot</option>
            <option value="dash-dot">Dash-Dot</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Width</label>
          <input
            type="number"
            min={1}
            max={10}
            value={style.lineWidth ?? ''}
            onChange={(e) =>
              onChange('lineWidth', e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="—"
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Color</label>
          <input
            type="color"
            value={style.color || '#6366f1'}
            onChange={(e) => onChange('color', e.target.value)}
            style={colorInputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Routing</label>
          <select
            value={style.routingStyle || ''}
            onChange={(e) => onChange('routingStyle', e.target.value || undefined)}
            style={inputStyle}
          >
            <option value="">— inherit —</option>
            <option value="straight">Straight</option>
            <option value="manhattan">Manhattan</option>
            <option value="tree">Tree</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Styles ────────────────────────────────────────────────────────── */

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 2,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  fontSize: 11,
  fontFamily: 'inherit',
  background: 'var(--surface)',
  color: 'var(--text)',
  boxSizing: 'border-box',
};

const colorInputStyle: React.CSSProperties = {
  width: '100%',
  height: 22,
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  borderRadius: 3,
};

const btnAddStyle: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 11,
  fontWeight: 500,
  border: '1px dashed var(--border)',
  borderRadius: 5,
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  textAlign: 'center',
};

const btnRemoveStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 14,
  borderRadius: 3,
  lineHeight: 1,
};

export default ConditionalStyleEditor;
