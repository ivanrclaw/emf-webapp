/**
 * @emf-webapp/frontend — Custom Edge Components for Ecore Diagram Editor
 *
 * Define tres tipos de edges personalizados para @xyflow/react:
 *   - referenceEdge:    línea sólida, flecha abierta en target, etiqueta + cardinalidad
 *   - containmentEdge:  línea sólida, diamante relleno en source + flecha abierta en target, etiqueta
 *   - inheritanceEdge:  línea discontinua, triángulo vacío en target, sin etiqueta
 */

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { EcoreEdgeData } from '../types';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** Formatea la cardinalidad de una referencia EMF */
function formatCardinality(lowerBound: number, upperBound: number): string {
  const upper =
    upperBound === -1
      ? '*'
      : upperBound === lowerBound
        ? `${upperBound}`
        : `${upperBound}`;
  const lower = lowerBound === 0 && upperBound === -1 ? '' : `${lowerBound}`;
  if (lowerBound === upperBound && upperBound !== -1) {
    return `[${lowerBound}]`;
  }
  return `[${lowerBound}..${upper}]`;
}

// ─────────────────────────────────────────────────────────────────
// 1. ReferenceEdge  —  línea sólida (indigo), flecha abierta en target
// ─────────────────────────────────────────────────────────────────

function ReferenceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = '#6366f1';
  const strokeWidth = 2;

  const reference = data?.reference;
  const label = data?.label || '';
  const cardinality =
    reference
      ? formatCardinality(reference.lowerBound, reference.upperBound)
      : '';

  return (
    <>
      <defs>
        <marker
          id={`ref-arrow-${id}`}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </marker>
      </defs>

      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeLinecap: 'round',
          transition: 'opacity 0.15s',
          opacity: selected ? 0.85 : 1,
        }}
        markerEnd={`url(#ref-arrow-${id})`}
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: selected ? '#eef2ff' : '#ffffff',
              border: selected
                ? '1.5px solid #6366f1'
                : '1px solid #d4d4d8',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              pointerEvents: 'all',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              color: '#6366f1',
              fontWeight: 500,
              zIndex: 10,
              boxShadow: selected
                ? '0 0 0 2px rgba(99,102,241,0.2)'
                : '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
            onClick={(e) => {
              e.stopPropagation();
              data?.onSelect?.(id);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                data?.onSelect?.(id);
              }
            }}
          >
            {label}
            {cardinality && (
              <span
                style={{
                  marginLeft: 5,
                  color: '#a1a1aa',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              >
                {cardinality}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// 2. ContainmentEdge  —  línea sólida (verde), diamante relleno en
//    source + flecha abierta en target
// ─────────────────────────────────────────────────────────────────

function ContainmentEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = '#059669';
  const strokeWidth = 2;

  const reference = data?.reference;
  const label = data?.label || '';
  const cardinality =
    reference
      ? formatCardinality(reference.lowerBound, reference.upperBound)
      : '';

  return (
    <>
      <defs>
        <marker
          id={`cont-target-${id}`}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </marker>

        <marker
          id={`cont-source-${id}`}
          viewBox="0 0 12 12"
          refX="12"
          refY="6"
          markerWidth="10"
          markerHeight="10"
          orient="auto-start-reverse"
        >
          <polygon
            points="6,0 12,6 6,12 0,6"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth={1}
          />
        </marker>
      </defs>

      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeLinecap: 'round',
          transition: 'opacity 0.15s',
          opacity: selected ? 0.85 : 1,
        }}
        markerEnd={`url(#cont-target-${id})`}
        markerStart={`url(#cont-source-${id})`}
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: selected ? '#ecfdf5' : '#ffffff',
              border: selected
                ? '1.5px solid #059669'
                : '1px solid #d4d4d8',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              pointerEvents: 'all',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              color: '#059669',
              fontWeight: 500,
              zIndex: 10,
              boxShadow: selected
                ? '0 0 0 2px rgba(5,150,105,0.2)'
                : '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
            onClick={(e) => {
              e.stopPropagation();
              data?.onSelect?.(id);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                data?.onSelect?.(id);
              }
            }}
          >
            {label}
            {cardinality && (
              <span
                style={{
                  marginLeft: 5,
                  color: '#a1a1aa',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              >
                {cardinality}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// 3. InheritanceEdge  —  línea discontinua (gris), triángulo vacío
//    en target, sin etiqueta
// ─────────────────────────────────────────────────────────────────

function InheritanceEdge(props: EdgeProps<Edge<EcoreEdgeData>>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
  } = props;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = '#888888';
  const strokeWidth = 1.5;

  return (
    <>
      <defs>
        <marker
          id={`inherit-arrow-${id}`}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </marker>
      </defs>

      <BaseEdge
        path={edgePath}
        interactionWidth={20}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeLinecap: 'round',
          strokeDasharray: '5 5',
          transition: 'opacity 0.15s',
          opacity: selected ? 0.8 : 1,
        }}
        markerEnd={`url(#inherit-arrow-${id})`}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Edge type registry  —  impórtalo en el ReactFlow como edgeTypes
// ─────────────────────────────────────────────────────────────────

export const edgeTypes = {
  referenceEdge: ReferenceEdge,
  containmentEdge: ContainmentEdge,
  inheritanceEdge: InheritanceEdge,
};
