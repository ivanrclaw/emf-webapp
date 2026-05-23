/**
 * @emf-webapp/frontend — CrossingBridges
 *
 * Renders circuit-style arc bridges at crossing points between edge paths.
 * When one edge crosses another, the "over" edge shows a small semicircular
 * arc (bump) to clearly indicate it passes over the other — just like in
 * electronic circuit diagrams.
 */
import React from 'react';
import { BRIDGE_RADIUS } from '../../lib/edge-routing';
import type { CrossingPoint } from '../../lib/edge-routing';

interface CrossingBridgesProps {
  edgeId: string;
  crossings: CrossingPoint[];
  edgePath?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

/**
 * Compute the arc path segment for a bridge at a crossing point.
 * The arc is a semicircle perpendicular to the edge direction at the crossing.
 */
function computeBridgeArc(
  crossing: CrossingPoint,
  edgePath: string | undefined,
  radius: number,
): string | null {
  if (!edgePath) return null;

  const { point, angle } = crossing;
  // Determine the direction of the edge at the crossing point
  // Use the angle to orient the arc perpendicular to the other edge
  const perpAngle = angle / 2; // bisector angle for the arc orientation

  // Simple approach: arc goes "up" (negative Y) relative to the edge direction
  // We create a semicircular detour
  const r = radius;
  const cx = point.x;
  const cy = point.y;

  // Arc from left of crossing to right of crossing, bumping upward
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
}

export function CrossingBridges({
  edgeId,
  crossings,
  edgePath,
  strokeColor = 'var(--border)',
  strokeWidth = 1.5,
}: CrossingBridgesProps) {
  // Only render bridges where this edge is the "over" edge (edgeId1)
  const relevant = crossings.filter((c) => c.edgeId1 === edgeId);
  if (relevant.length === 0) return null;

  return (
    <g className="crossing-bridges" pointerEvents="none">
      {relevant.map((c, idx) => {
        const r = BRIDGE_RADIUS + 2;
        const { point } = c;

        // Determine arc orientation based on the crossing angle
        // For orthogonal crossings, we know one edge is horizontal and one vertical
        // The "over" edge gets the arc bump
        const isHorizontalCrossing = Math.abs(c.angle - Math.PI / 2) < 0.3;

        return (
          <React.Fragment key={`bridge-${idx}`}>
            {/* Background to hide the "under" edge at the crossing */}
            <circle
              cx={point.x}
              cy={point.y}
              r={r + 1}
              fill="var(--bg, #0f0f23)"
              stroke="none"
            />
            {/* Arc bridge — semicircle bump */}
            {isHorizontalCrossing ? (
              // Edge is horizontal, arc bumps upward
              <path
                d={`M ${point.x - r} ${point.y} A ${r} ${r} 0 0 1 ${point.x + r} ${point.y}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            ) : (
              // Edge is vertical, arc bumps to the right
              <path
                d={`M ${point.x} ${point.y - r} A ${r} ${r} 0 0 1 ${point.x} ${point.y + r}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            )}
          </React.Fragment>
        );
      })}
    </g>
  );
}
