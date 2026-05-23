/**
 * @emf-webapp/frontend — VsmContainerNode
 *
 * ReactFlow custom node for the runtime model editor. Renders M1 container
 * objects according to their VSM ContainerMapping style, with a header area
 * for the label and a body area showing the children presentation mode.
 * Evaluates conditional styles against the semantic data of the instance.
 */
import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ContainerMapping, NodeStyle, LineStyleType, ChildrenPresentation } from '../spec-diagram/types';
import { evaluateLabel, evaluatePredicate } from '../../lib/expression-engine';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface VsmContainerNodeData extends Record<string, unknown> {
  mapping: ContainerMapping;
  semanticData: Record<string, unknown>;
  selected: boolean;
  hasError?: boolean;
  hasWarning?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const handleStyle = {
  background: 'var(--text-secondary, #71717a)',
  width: 7,
  height: 7,
  border: '2px solid var(--surface, #1e1e2e)',
};

function borderStyleValue(lineStyle: LineStyleType): string {
  switch (lineStyle) {
    case 'dash': return 'dashed';
    case 'dot': return 'dotted';
    case 'dash-dot': return 'dashed';
    default: return 'solid';
  }
}

function presentationIcon(mode: ChildrenPresentation): string {
  switch (mode) {
    case 'FreeForm': return '⊞';
    case 'List': return '☰';
    case 'HorizontalStack': return '⟷';
    case 'VerticalStack': return '⟘';
    default: return '⊞';
  }
}

function presentationDescription(mode: ChildrenPresentation): string {
  switch (mode) {
    case 'FreeForm': return 'Free-form layout';
    case 'List': return 'Vertical list';
    case 'HorizontalStack': return 'Horizontal stack';
    case 'VerticalStack': return 'Vertical stack';
    default: return mode;
  }
}

/**
 * Resolve the effective style by evaluating conditional styles against
 * the semantic data. The first matching conditional style's properties
 * override the defaultStyle.
 */
function resolveStyle(mapping: ContainerMapping, semanticData: Record<string, unknown>): NodeStyle {
  const { defaultStyle, conditionalStyles } = mapping;

  for (const conditional of conditionalStyles) {
    if (evaluatePredicate(conditional.predicateExpression, { self: semanticData })) {
      return { ...defaultStyle, ...conditional.style };
    }
  }

  return defaultStyle;
}

/* ------------------------------------------------------------------ */
/*  VsmContainerNode Component                                          */
/* ------------------------------------------------------------------ */

function VsmContainerNode(props: NodeProps<Node<VsmContainerNodeData>>) {
  const { data } = props;
  const { mapping, semanticData, selected, hasError, hasWarning } = data;

  const resolvedStyle = useMemo(
    () => resolveStyle(mapping, semanticData),
    [mapping, semanticData],
  );

  const label = useMemo(
    () => evaluateLabel(resolvedStyle.labelExpression, { self: semanticData }),
    [resolvedStyle.labelExpression, semanticData],
  );

  const width = resolvedStyle.width ?? 220;
  const height = resolvedStyle.height ?? 140;
  const headerHeight = 32;

  const borderCss = borderStyleValue(resolvedStyle.borderLineStyle);

  const containerStyle = useMemo(() => ({
    width,
    height,
    borderRadius: resolvedStyle.shape === 'rounded-rectangle' ? 12 : 4,
    border: `${Math.max(resolvedStyle.borderSize, 1)}px ${borderCss} ${resolvedStyle.borderColor}`,
    background: resolvedStyle.color,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
    boxShadow: selected
      ? '0 0 0 3px var(--primary, #6366f1), 0 0 16px rgba(99,102,241,0.4)'
      : hasError
        ? '0 0 0 2px #ef4444, 0 0 12px rgba(239,68,68,0.3)'
        : hasWarning
          ? '0 0 0 2px #eab308, 0 0 12px rgba(234,179,8,0.3)'
          : '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'box-shadow 0.15s ease',
    animation: hasError ? 'pulse-error 2s infinite' : undefined,
    cursor: 'pointer',
  }), [width, height, resolvedStyle, borderCss, selected, hasError, hasWarning]);

  const headerStyle = useMemo(() => ({
    height: headerHeight,
    minHeight: headerHeight,
    display: 'flex' as const,
    alignItems: 'center' as const,
    padding: '0 10px',
    gap: 6,
    background: `${resolvedStyle.borderColor}30`,
    borderBottom: `1px solid ${resolvedStyle.borderColor}50`,
  }), [headerHeight, resolvedStyle.borderColor]);

  return (
    <div style={containerStyle}>
      {/* Handles on all 4 sides */}
      <Handle type="target" position={Position.Top} id="top" style={{ ...handleStyle, top: -4 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ ...handleStyle, left: -4 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...handleStyle, bottom: -4 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, right: -4 }} />

      {/* Header bar */}
      <div style={headerStyle}>
        <span style={{
          fontSize: resolvedStyle.labelSize,
          fontWeight: resolvedStyle.labelBold ? 700 : 600,
          fontStyle: resolvedStyle.labelItalic ? 'italic' : 'normal',
          color: resolvedStyle.labelColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 10,
          color: resolvedStyle.labelColor,
          opacity: 0.6,
          fontWeight: 500,
        }}>
          ▾
        </span>
      </div>

      {/* Body area showing children presentation mode */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 8,
      }}>
        <span style={{
          fontSize: 20,
          opacity: 0.5,
          color: resolvedStyle.labelColor,
        }}>
          {presentationIcon(mapping.childrenPresentation)}
        </span>
        <span style={{
          fontSize: 10,
          color: resolvedStyle.labelColor,
          opacity: 0.6,
          fontWeight: 500,
          textAlign: 'center',
        }}>
          {presentationDescription(mapping.childrenPresentation)}
        </span>
        {/* Placeholder children indicators */}
        <div style={{
          display: 'flex',
          gap: 4,
          alignItems: mapping.childrenPresentation === 'HorizontalStack' ? 'center' : 'flex-start',
          flexDirection: mapping.childrenPresentation === 'HorizontalStack' ? 'row' : 'column',
          marginTop: 4,
        }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: mapping.childrenPresentation === 'HorizontalStack' ? 20 : 40,
                height: mapping.childrenPresentation === 'List' || mapping.childrenPresentation === 'VerticalStack' ? 6 : 12,
                borderRadius: 2,
                background: `${resolvedStyle.labelColor}20`,
                border: `1px solid ${resolvedStyle.labelColor}30`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(VsmContainerNode);
