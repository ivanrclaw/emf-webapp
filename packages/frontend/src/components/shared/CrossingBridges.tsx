/**
 * @emf-webapp/frontend — CrossingBridges
 *
 * Renders small white circles at crossing points between edge paths,
 * creating a visual "bridge" so the user can distinguish crossing from junction.
 */
import React from 'react';
import { BRIDGE_RADIUS } from '../../lib/edge-routing';
import type { CrossingPoint } from '../../lib/edge-routing';

interface CrossingBridgesProps {
  edgeId: string;
  crossings: CrossingPoint[];
  /** Background color to match the canvas (default: dark theme) */
  bgColor?: string;
}

export function CrossingBridges({ edgeId, crossings, bgColor = '#0f0f23' }: CrossingBridgesProps) {
  const relevant = crossings.filter(
    (c) => c.edgeId1 === edgeId || c.edgeId2 === edgeId,
  );
  if (relevant.length === 0) return null;

  return (
    <g>
      {relevant.map((c, idx) => {
        // Determine if this edge is the one that goes "over" (has smaller angle from horizontal/vertical)
        const isOver = c.edgeId1 === edgeId;
        const r = BRIDGE_RADIUS + (isOver ? 0 : 1);
        return (
          <React.Fragment key={`cb-${idx}`}>
            {/* Background circle to hide the other edge */}
            {isOver && (
              <circle
                cx={c.point.x}
                cy={c.point.y}
                r={BRIDGE_RADIUS + 1}
                fill={bgColor}
                stroke="none"
                pointerEvents="none"
              />
            )}
            {/* Small arc indicator */}
            <circle
              cx={c.point.x}
              cy={c.point.y}
              r={r - 1}
              fill="none"
              stroke={isOver ? 'var(--text-muted, #555)' : 'transparent'}
              strokeWidth={1}
              strokeDasharray={isOver ? '2 2' : undefined}
              opacity={0.5}
              pointerEvents="none"
            />
          </React.Fragment>
        );
      })}
    </g>
  );
}
