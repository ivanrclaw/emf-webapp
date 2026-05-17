/**
 * @emf-webapp/frontend — SpecContainerNode
 *
 * ReactFlow custom node that renders a PREVIEW of how a ContainerMapping
 * will look in the runtime editor. Shows a header bar with the class name
 * and a body area indicating the childrenPresentation mode.
 */
import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ContainerMapping, LineStyleType, ChildrenPresentation } from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SpecContainerNodeData extends Record<string, unknown> {
  mapping: ContainerMapping;
  selected: boolean;
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

/* ------------------------------------------------------------------ */
/*  SpecContainerNode Component                                        */
/* ------------------------------------------------------------------ */

function SpecContainerNode(props: NodeProps<Node<SpecContainerNodeData>>) {
  const { data } = props;
  const { mapping, selected } = data;
  const style = mapping.defaultStyle;

  const label = mapping.domainClass || 'Container';
  const width = style.width ?? 220;
  const height = style.height ?? 140;
  const headerHeight = 32;

  const borderCss = borderStyleValue(style.borderLineStyle);

  const containerStyle = useMemo(() => ({
    width,
    height,
    borderRadius: style.shape === 'rounded-rectangle' ? 12 : 4,
    border: `${Math.max(style.borderSize, 1)}px ${borderCss} ${style.borderColor}`,
    background: style.color,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
    boxShadow: selected
      ? '0 0 0 3px var(--primary, #6366f1), 0 0 16px rgba(99,102,241,0.4)'
      : '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'box-shadow 0.15s ease',
    cursor: 'pointer',
  }), [width, height, style, borderCss, selected]);

  const headerStyle = useMemo(() => ({
    height: headerHeight,
    minHeight: headerHeight,
    display: 'flex' as const,
    alignItems: 'center' as const,
    padding: '0 10px',
    gap: 6,
    background: `${style.borderColor}30`,
    borderBottom: `1px solid ${style.borderColor}50`,
  }), [headerHeight, style.borderColor]);

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
          fontSize: style.labelSize,
          fontWeight: style.labelBold ? 700 : 600,
          fontStyle: style.labelItalic ? 'italic' : 'normal',
          color: style.labelColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 10,
          color: style.labelColor,
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
          color: style.labelColor,
        }}>
          {presentationIcon(mapping.childrenPresentation)}
        </span>
        <span style={{
          fontSize: 10,
          color: style.labelColor,
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
                background: `${style.labelColor}20`,
                border: `1px solid ${style.labelColor}30`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(SpecContainerNode);
