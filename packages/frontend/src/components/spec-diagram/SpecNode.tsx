/**
 * @emf-webapp/frontend — SpecNode
 *
 * Nodo React Flow que renderiza un elemento de especificación gráfica
 * con su estilo visual configurado (shape, color, border, label).
 * Soporta tres shapes: rectangle, ellipse, diamond.
 */
import { useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SpecNodeData {
  /** Nombre de la clase del dominio */
  label: string;
  /** Tipo de shape visual */
  shape: 'rectangle' | 'ellipse' | 'diamond';
  /** Color de relleno */
  color: string;
  /** Color del borde */
  borderColor: string;
  /** Grosor del borde */
  borderSize: number;
  /** Posición del label */
  labelPosition: 'inside' | 'top' | 'bottom';
  /** Indica si este nodo está seleccionado */
  selected?: boolean;
  /** Callback al hacer click */
  onClick?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Shape Renderers                                                    */
/* ------------------------------------------------------------------ */

function RectangleContent({
  color,
  borderColor,
  borderSize,
  label,
  labelPosition,
  width = 180,
  height = 70,
}: {
  color: string; borderColor: string; borderSize: number;
  label: string; labelPosition: string;
  width?: number; height?: number;
}) {
  const labelInside = (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 600, color: '#fff',
      textShadow: '0 1px 3px rgba(0,0,0,0.3)',
      padding: '2px 8px',
    }}>
      {label}
    </span>
  );

  return (
    <div style={{ position: 'relative', width, height }}>
      {labelPosition === 'top' && (
        <div style={{
          position: 'absolute', top: -24, left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 600,
          color: 'var(--text)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </div>
      )}
      <div style={{
        width: '100%', height: '100%',
        borderRadius: 8,
        background: color,
        border: `${borderSize}px solid ${borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {labelPosition === 'inside' && labelInside}
      </div>
      {labelPosition === 'bottom' && (
        <div style={{
          position: 'absolute', bottom: -24, left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 600,
          color: 'var(--text)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

function EllipseContent({
  color, borderColor, borderSize, label, labelPosition,
  width = 180, height = 70,
}: {
  color: string; borderColor: string; borderSize: number;
  label: string; labelPosition: string;
  width?: number; height?: number;
}) {
  return (
    <div style={{ position: 'relative', width, height }}>
      {labelPosition === 'top' && (
        <div style={{
          position: 'absolute', top: -24, left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 600,
          color: 'var(--text)', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      )}
      <div style={{
        width: '100%', height: '100%',
        borderRadius: '50%',
        background: color,
        border: `${borderSize}px solid ${borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {labelPosition === 'inside' && (
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            padding: '2px 8px',
          }}>
            {label}
          </span>
        )}
      </div>
      {labelPosition === 'bottom' && (
        <div style={{
          position: 'absolute', bottom: -24, left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 600,
          color: 'var(--text)', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

function DiamondContent({
  color, borderColor, borderSize, label, labelPosition,
  width = 180, height = 120,
}: {
  color: string; borderColor: string; borderSize: number;
  label: string; labelPosition: string;
  width?: number; height?: number;
}) {
  // Diamond rendered with clip-path
  return (
    <div style={{ position: 'relative', width, height }}>
      {labelPosition === 'top' && (
        <div style={{
          position: 'absolute', top: -24, left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 600,
          color: 'var(--text)', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      )}
      <div style={{
        width: '100%', height: '100%',
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Inner diamond for border effect */}
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          border: `${borderSize}px solid ${borderColor}`,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }} />
        {labelPosition === 'inside' && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            padding: '2px 4px', textAlign: 'center',
            zIndex: 1,
          }}>
            {label}
          </span>
        )}
      </div>
      {labelPosition === 'bottom' && (
        <div style={{
          position: 'absolute', bottom: -24, left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 600,
          color: 'var(--text)', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SpecNode Component                                                 */
/* ------------------------------------------------------------------ */

export default function SpecNode(props: NodeProps) {
  const data = props.data as SpecNodeData;
  const { shape, color, borderColor, borderSize, label, labelPosition, selected } = data;

  const shapeContent = useMemo(() => {
    switch (shape) {
      case 'ellipse':
        return <EllipseContent {...{ color, borderColor, borderSize: Math.max(borderSize, 2), label, labelPosition }} />;
      case 'diamond':
        return <DiamondContent {...{ color, borderColor, borderSize: Math.max(borderSize, 2), label, labelPosition }} />;
      default:
        return <RectangleContent {...{ color, borderColor, borderSize: Math.max(borderSize, 2), label, labelPosition }} />;
    }
  }, [shape, color, borderColor, borderSize, label, labelPosition]);

  const outlineStyle = selected
    ? { boxShadow: '0 0 0 3px var(--primary), 0 0 16px rgba(99,102,241,0.4)' }
    : {};

  const borderSupplement =
    (labelPosition === 'top' || labelPosition === 'bottom')
      ? { borderBottom: `2px solid ${color}` }
      : {};

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ...outlineStyle,
        borderRadius: shape === 'ellipse' ? '50%' : shape === 'diamond' ? 4 : 10,
        ...borderSupplement,
      }}
    >
      {/* Source handles — both sides for connection flexibility */}
      <Handle type="source" position={Position.Left} id="left" style={{ background: 'var(--text-secondary)', width: 8, height: 8, border: '2px solid var(--surface)' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: 'var(--text-secondary)', width: 8, height: 8, border: '2px solid var(--surface)' }} />

      {shapeContent}
    </div>
  );
}
