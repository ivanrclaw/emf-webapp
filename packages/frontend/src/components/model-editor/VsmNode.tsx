/**
 * @emf-webapp/frontend — VsmNode
 *
 * ReactFlow custom node for the runtime model editor. Renders M1 objects
 * according to their VSM NodeMapping style, evaluating conditional styles
 * against the semantic data of the instance.
 */
import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { NodeMapping, NodeStyle, LineStyleType, LabelPosition } from '../spec-diagram/types';
import { evaluateLabel, evaluatePredicate } from '../../lib/expression-engine';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface VsmNodeData extends Record<string, unknown> {
  mapping: NodeMapping;
  semanticData: Record<string, unknown>;
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

function borderDashStyle(lineStyle: LineStyleType): string | undefined {
  switch (lineStyle) {
    case 'dash': return '6 3';
    case 'dot': return '2 3';
    case 'dash-dot': return '6 3 2 3';
    default: return undefined;
  }
}

/**
 * Resolve the effective style by evaluating conditional styles against
 * the semantic data. The first matching conditional style's properties
 * override the defaultStyle.
 */
function resolveStyle(mapping: NodeMapping, semanticData: Record<string, unknown>): NodeStyle {
  const { defaultStyle, conditionalStyles } = mapping;

  for (const conditional of conditionalStyles) {
    if (evaluatePredicate(conditional.predicateExpression, { self: semanticData })) {
      return { ...defaultStyle, ...conditional.style };
    }
  }

  return defaultStyle;
}

/* ------------------------------------------------------------------ */
/*  Shape Renderers                                                    */
/* ------------------------------------------------------------------ */

interface ShapeProps {
  color: string;
  borderColor: string;
  borderSize: number;
  borderLineStyle: LineStyleType;
  label: string;
  labelColor: string;
  labelSize: number;
  labelPosition: LabelPosition;
  labelBold: boolean;
  labelItalic: boolean;
  width: number;
  height: number;
}

function LabelElement({ label, labelColor, labelSize, labelBold, labelItalic }: {
  label: string; labelColor: string; labelSize: number; labelBold: boolean; labelItalic: boolean;
}) {
  return (
    <span style={{
      fontSize: labelSize,
      fontWeight: labelBold ? 700 : 600,
      fontStyle: labelItalic ? 'italic' : 'normal',
      color: labelColor,
      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
      padding: '2px 8px',
      textAlign: 'center',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
    }}>
      {label}
    </span>
  );
}

function ExternalLabel({ label, labelColor, labelSize, labelBold, labelItalic, position }: {
  label: string; labelColor: string; labelSize: number; labelBold: boolean; labelItalic: boolean;
  position: 'top' | 'bottom' | 'border';
}) {
  const posStyle = position === 'top'
    ? { top: -22, left: 0, right: 0 }
    : position === 'bottom'
      ? { bottom: -22, left: 0, right: 0 }
      : { top: -11, left: 8 }; // border = on the border line

  return (
    <div style={{
      position: 'absolute',
      ...posStyle,
      textAlign: position === 'border' ? 'left' : 'center',
      fontSize: labelSize,
      fontWeight: labelBold ? 700 : 600,
      fontStyle: labelItalic ? 'italic' : 'normal',
      color: labelColor,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      background: position === 'border' ? 'var(--surface, #1e1e2e)' : undefined,
      padding: position === 'border' ? '0 4px' : undefined,
      borderRadius: position === 'border' ? 2 : undefined,
      zIndex: 2,
    }}>
      {label}
    </div>
  );
}

function RectangleShape(props: ShapeProps) {
  const { color, borderColor, borderSize, borderLineStyle, label, labelColor, labelSize, labelPosition, labelBold, labelItalic, width, height } = props;
  const dash = borderDashStyle(borderLineStyle);

  return (
    <div style={{ position: 'relative', width, height }}>
      {labelPosition !== 'inside' && (
        <ExternalLabel label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} position={labelPosition} />
      )}
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: 4,
        background: color,
        border: `${borderSize}px solid ${borderColor}`,
        borderStyle: dash ? 'dashed' : 'solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {labelPosition === 'inside' && (
          <LabelElement label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} />
        )}
      </div>
    </div>
  );
}

function RoundedRectangleShape(props: ShapeProps) {
  const { color, borderColor, borderSize, borderLineStyle, label, labelColor, labelSize, labelPosition, labelBold, labelItalic, width, height } = props;
  const dash = borderDashStyle(borderLineStyle);

  return (
    <div style={{ position: 'relative', width, height }}>
      {labelPosition !== 'inside' && (
        <ExternalLabel label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} position={labelPosition} />
      )}
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        background: color,
        border: `${borderSize}px solid ${borderColor}`,
        borderStyle: dash ? 'dashed' : 'solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {labelPosition === 'inside' && (
          <LabelElement label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} />
        )}
      </div>
    </div>
  );
}

function EllipseShape(props: ShapeProps) {
  const { color, borderColor, borderSize, borderLineStyle, label, labelColor, labelSize, labelPosition, labelBold, labelItalic, width, height } = props;
  const dash = borderDashStyle(borderLineStyle);

  return (
    <div style={{ position: 'relative', width, height }}>
      {labelPosition !== 'inside' && (
        <ExternalLabel label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} position={labelPosition} />
      )}
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: color,
        border: `${borderSize}px solid ${borderColor}`,
        borderStyle: dash ? 'dashed' : 'solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {labelPosition === 'inside' && (
          <LabelElement label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} />
        )}
      </div>
    </div>
  );
}

function DiamondShape(props: ShapeProps) {
  const { color, borderColor, borderSize, borderLineStyle, label, labelColor, labelSize, labelPosition, labelBold, labelItalic, width, height } = props;
  const size = Math.min(width, height);
  const dash = borderDashStyle(borderLineStyle);

  return (
    <div style={{ position: 'relative', width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {labelPosition !== 'inside' && (
        <ExternalLabel label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} position={labelPosition} />
      )}
      <div style={{
        width: size * 0.7,
        height: size * 0.7,
        transform: 'rotate(45deg)',
        background: color,
        border: `${borderSize}px solid ${borderColor}`,
        borderStyle: dash ? 'dashed' : 'solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {labelPosition === 'inside' && (
          <div style={{ transform: 'rotate(-45deg)' }}>
            <LabelElement label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} />
          </div>
        )}
      </div>
    </div>
  );
}

function NoteShape(props: ShapeProps) {
  const { color, borderColor, borderSize, borderLineStyle, label, labelColor, labelSize, labelPosition, labelBold, labelItalic, width, height } = props;
  const foldSize = 14;
  const dash = borderDashStyle(borderLineStyle);

  return (
    <div style={{ position: 'relative', width, height }}>
      {labelPosition !== 'inside' && (
        <ExternalLabel label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} position={labelPosition} />
      )}
      <div style={{
        width: '100%',
        height: '100%',
        background: color,
        border: `${borderSize}px solid ${borderColor}`,
        borderStyle: dash ? 'dashed' : 'solid',
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Folded corner */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: `0 ${foldSize}px ${foldSize}px 0`,
          borderColor: `transparent var(--surface, #1e1e2e) transparent transparent`,
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: `${foldSize}px 0 0 ${foldSize}px`,
          borderColor: `${borderColor} transparent transparent transparent`,
        }} />
        {labelPosition === 'inside' && (
          <LabelElement label={label} labelColor={labelColor} labelSize={labelSize} labelBold={labelBold} labelItalic={labelItalic} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  VsmNode Component                                                   */
/* ------------------------------------------------------------------ */

function VsmNode(props: NodeProps<Node<VsmNodeData>>) {
  const { data } = props;
  const { mapping, semanticData, selected } = data;

  const resolvedStyle = useMemo(
    () => resolveStyle(mapping, semanticData),
    [mapping, semanticData],
  );

  const label = useMemo(
    () => evaluateLabel(resolvedStyle.labelExpression, { self: semanticData }),
    [resolvedStyle.labelExpression, semanticData],
  );

  const width = resolvedStyle.width ?? 160;
  const height = resolvedStyle.height ?? 64;

  const shapeProps: ShapeProps = useMemo(() => ({
    color: resolvedStyle.color,
    borderColor: resolvedStyle.borderColor,
    borderSize: Math.max(resolvedStyle.borderSize, 1),
    borderLineStyle: resolvedStyle.borderLineStyle,
    label,
    labelColor: resolvedStyle.labelColor,
    labelSize: resolvedStyle.labelSize,
    labelPosition: resolvedStyle.labelPosition,
    labelBold: resolvedStyle.labelBold,
    labelItalic: resolvedStyle.labelItalic,
    width,
    height,
  }), [resolvedStyle, label, width, height]);

  const shapeContent = useMemo(() => {
    switch (resolvedStyle.shape) {
      case 'rounded-rectangle': return <RoundedRectangleShape {...shapeProps} />;
      case 'ellipse': return <EllipseShape {...shapeProps} />;
      case 'diamond': return <DiamondShape {...shapeProps} />;
      case 'note': return <NoteShape {...shapeProps} />;
      case 'rectangle':
      default: return <RectangleShape {...shapeProps} />;
    }
  }, [resolvedStyle.shape, shapeProps]);

  return (
    <div
      style={{
        cursor: 'pointer',
        borderRadius: resolvedStyle.shape === 'ellipse' ? '50%' : 8,
        boxShadow: selected
          ? '0 0 0 3px var(--primary, #6366f1), 0 0 16px rgba(99,102,241,0.4)'
          : '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <Handle type="target" position={Position.Top} id="top" style={{ ...handleStyle, top: -4 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ ...handleStyle, left: -4 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...handleStyle, bottom: -4 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, right: -4 }} />

      {shapeContent}
    </div>
  );
}

export default memo(VsmNode);
