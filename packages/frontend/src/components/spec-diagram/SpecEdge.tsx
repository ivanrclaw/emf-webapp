/**
 * @emf-webapp/frontend — SpecEdge
 *
 * Edge React Flow que renderiza una conexión entre mappings
 * con el estilo visual configurado (lineStyle, decorations, color).
 */
import { BaseEdge, getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SpecEdgeData {
  /** Estilo de línea */
  lineStyle: 'solid' | 'dash' | 'dot' | 'dash-dot';
  /** Decoración del lado source */
  sourceDecoration: 'none' | 'arrow' | 'diamond' | 'filled-diamond';
  /** Decoración del lado target */
  targetDecoration: 'none' | 'arrow' | 'diamond' | 'filled-diamond';
  /** Color del edge */
  color: string;
  /** Expresión del label (opcional) */
  labelExpression?: string;
  /** Label calculado (nombre del mapping target) */
  label?: string;
}

/* ------------------------------------------------------------------ */
/*  SVG Marker IDs (unique per edge ID to avoid conflicts)             */
/* ------------------------------------------------------------------ */

function markerId(edgeId: string, type: string) {
  return `spec-${type}-${edgeId}`;
}

function ArrowMarker({ id, color, filled }: { id: string; color: string; filled: boolean }) {
  return (
    <marker id={id} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
      <path d="M 1 1 L 11 6 L 1 11 Z" fill={filled ? color : 'transparent'} stroke={color} strokeWidth={1} />
    </marker>
  );
}

function DiamondMarker({ id, color, filled }: { id: string; color: string; filled: boolean }) {
  return (
    <marker id={id} viewBox="0 0 14 14" refX="12" refY="7" markerWidth="12" markerHeight="12" orient="auto">
      <polygon
        points="7,0 14,7 7,14 0,7"
        fill={filled ? color : 'transparent'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </marker>
  );
}

/* ------------------------------------------------------------------ */
/*  Stroke Dash Arrays                                                  */
/* ------------------------------------------------------------------ */

function strokeDasharray(lineStyle: string): string {
  switch (lineStyle) {
    case 'dash': return '8 4';
    case 'dot': return '2 4';
    case 'dash-dot': return '8 4 2 4';
    default: return '';
  }
}

/* ------------------------------------------------------------------ */
/*  SpecEdge Component                                                  */
/* ------------------------------------------------------------------ */

export default function SpecEdge(props: EdgeProps) {
  const {
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data,
    selected,
  } = props;
  const edgeData = data as SpecEdgeData | undefined;

  const lineStyle = edgeData?.lineStyle ?? 'solid';
  const color = edgeData?.color ?? '#6366f1';
  const sourceDeco = edgeData?.sourceDecoration ?? 'none';
  const targetDeco = edgeData?.targetDecoration ?? 'arrow';
  const label = edgeData?.label ?? '';

  // Build marker-end and marker-start URLs
  const markerStart = sourceDeco !== 'none'
    ? `url(#${markerId(id, `source-${sourceDeco}`)})`
    : undefined;
  const markerEnd = targetDeco !== 'none'
    ? `url(#${markerId(id, `target-${targetDeco}`)})`
    : undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      {/* SVG Defs for this edge's markers */}
      <defs>
        {(sourceDeco === 'arrow' || targetDeco === 'arrow') && (
          <ArrowMarker id={markerId(id, 'source-arrow')} color={color} filled={false} />
        )}
        {(sourceDeco === 'filled-diamond' || targetDeco === 'filled-diamond') && (
          <DiamondMarker id={markerId(id, 'source-filled-diamond')} color={color} filled={true} />
        )}
        {(sourceDeco === 'diamond' || targetDeco === 'diamond') && (
          <DiamondMarker id={markerId(id, 'source-diamond')} color={color} filled={false} />
        )}
        {(targetDeco === 'arrow') && (
          <ArrowMarker id={markerId(id, 'target-arrow')} color={color} filled={false} />
        )}
        {(targetDeco === 'filled-diamond') && (
          <DiamondMarker id={markerId(id, 'target-filled-diamond')} color={color} filled={true} />
        )}
        {(targetDeco === 'diamond') && (
          <DiamondMarker id={markerId(id, 'target-diamond')} color={color} filled={false} />
        )}
      </defs>

      <BaseEdge
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: strokeDasharray(lineStyle),
          markerStart,
          markerEnd,
        }}
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--surface)',
              border: `1px solid ${color}`,
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
              fontWeight: 600,
              color,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
