/**
 * SnapGuides — SVG overlay that renders alignment snap guides during node dragging.
 *
 * Draws dashed lines to indicate alignment with other nodes (edges and centers).
 * Also exports the useSnapGuides hook for computing snap positions and active lines.
 *
 * Node dimensions assumed: 180×80 (consistent with alignment hooks).
 */
import React, { useState, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SnapLine {
  type: 'horizontal' | 'vertical';
  position: number; // x for vertical, y for horizontal
  start: number; // start coordinate on the other axis
  end: number; // end coordinate on the other axis
}

export interface SnapGuidesProps {
  lines: SnapLine[];
  viewport: { x: number; y: number; zoom: number };
}

interface Node {
  id: string;
  position: { x: number; y: number };
}

interface SnapGuidesOptions {
  enabled: boolean;
  threshold: number;
  gridSize?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

// ─── Component ────────────────────────────────────────────────────────────────

export function SnapGuides({ lines, viewport }: SnapGuidesProps) {
  if (lines.length === 0) return null;

  const { x: vx, y: vy, zoom } = viewport;
  const strokeWidth = 1 / zoom;

  return (
    <svg
      style={styles.overlay}
      aria-hidden="true"
    >
      <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
        {lines.map((line, i) => {
          if (line.type === 'horizontal') {
            return (
              <line
                key={`h-${i}`}
                x1={line.start}
                y1={line.position}
                x2={line.end}
                y2={line.position}
                stroke="var(--primary-light)"
                strokeWidth={strokeWidth}
                strokeDasharray="4 4"
              />
            );
          }
          return (
            <line
              key={`v-${i}`}
              x1={line.position}
              y1={line.start}
              x2={line.position}
              y2={line.end}
              stroke="var(--primary-light)"
              strokeWidth={strokeWidth}
              strokeDasharray="4 4"
            />
          );
        })}
      </g>
    </svg>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSnapGuides(options: SnapGuidesOptions): {
  lines: SnapLine[];
  onNodeDrag: (draggingId: string, position: { x: number; y: number }, allNodes: Node[]) => { x: number; y: number };
  onNodeDragStop: () => void;
} {
  const { enabled, threshold, gridSize } = options;
  const [lines, setLines] = useState<SnapLine[]>([]);
  const linesRef = useRef<SnapLine[]>([]);

  const onNodeDrag = useCallback(
    (draggingId: string, position: { x: number; y: number }, allNodes: Node[]): { x: number; y: number } => {
      if (!enabled) return position;

      let snappedX = position.x;
      let snappedY = position.y;
      const newLines: SnapLine[] = [];

      // Dragging node edges and center
      const dragLeft = position.x;
      const dragCenterX = position.x + NODE_WIDTH / 2;
      const dragRight = position.x + NODE_WIDTH;
      const dragTop = position.y;
      const dragCenterY = position.y + NODE_HEIGHT / 2;
      const dragBottom = position.y + NODE_HEIGHT;

      // Check alignment with other nodes
      const otherNodes = allNodes.filter((n) => n.id !== draggingId);

      let snappedHorizontal = false;
      let snappedVertical = false;

      for (const node of otherNodes) {
        const nodeLeft = node.position.x;
        const nodeCenterX = node.position.x + NODE_WIDTH / 2;
        const nodeRight = node.position.x + NODE_WIDTH;
        const nodeTop = node.position.y;
        const nodeCenterY = node.position.y + NODE_HEIGHT / 2;
        const nodeBottom = node.position.y + NODE_HEIGHT;

        // Vertical snap lines (align on X axis)
        if (!snappedVertical) {
          const xChecks = [
            { drag: dragLeft, target: nodeLeft, offset: 0 },
            { drag: dragLeft, target: nodeCenterX, offset: 0 },
            { drag: dragLeft, target: nodeRight, offset: 0 },
            { drag: dragCenterX, target: nodeLeft, offset: -NODE_WIDTH / 2 },
            { drag: dragCenterX, target: nodeCenterX, offset: -NODE_WIDTH / 2 },
            { drag: dragCenterX, target: nodeRight, offset: -NODE_WIDTH / 2 },
            { drag: dragRight, target: nodeLeft, offset: -NODE_WIDTH },
            { drag: dragRight, target: nodeCenterX, offset: -NODE_WIDTH },
            { drag: dragRight, target: nodeRight, offset: -NODE_WIDTH },
          ];

          for (const check of xChecks) {
            if (Math.abs(check.drag - check.target) <= threshold) {
              snappedX = check.target + check.offset;
              snappedVertical = true;
              const minY = Math.min(position.y, node.position.y) - 20;
              const maxY = Math.max(position.y + NODE_HEIGHT, node.position.y + NODE_HEIGHT) + 20;
              newLines.push({
                type: 'vertical',
                position: check.target,
                start: minY,
                end: maxY,
              });
              break;
            }
          }
        }

        // Horizontal snap lines (align on Y axis)
        if (!snappedHorizontal) {
          const yChecks = [
            { drag: dragTop, target: nodeTop, offset: 0 },
            { drag: dragTop, target: nodeCenterY, offset: 0 },
            { drag: dragTop, target: nodeBottom, offset: 0 },
            { drag: dragCenterY, target: nodeTop, offset: -NODE_HEIGHT / 2 },
            { drag: dragCenterY, target: nodeCenterY, offset: -NODE_HEIGHT / 2 },
            { drag: dragCenterY, target: nodeBottom, offset: -NODE_HEIGHT / 2 },
            { drag: dragBottom, target: nodeTop, offset: -NODE_HEIGHT },
            { drag: dragBottom, target: nodeCenterY, offset: -NODE_HEIGHT },
            { drag: dragBottom, target: nodeBottom, offset: -NODE_HEIGHT },
          ];

          for (const check of yChecks) {
            if (Math.abs(check.drag - check.target) <= threshold) {
              snappedY = check.target + check.offset;
              snappedHorizontal = true;
              const minX = Math.min(position.x, node.position.x) - 20;
              const maxX = Math.max(position.x + NODE_WIDTH, node.position.x + NODE_WIDTH) + 20;
              newLines.push({
                type: 'horizontal',
                position: check.target,
                start: minX,
                end: maxX,
              });
              break;
            }
          }
        }

        if (snappedHorizontal && snappedVertical) break;
      }

      // Grid snapping
      if (gridSize && gridSize > 0) {
        if (!snappedVertical) {
          const gridX = Math.round(snappedX / gridSize) * gridSize;
          if (Math.abs(snappedX - gridX) <= threshold) {
            snappedX = gridX;
          }
        }
        if (!snappedHorizontal) {
          const gridY = Math.round(snappedY / gridSize) * gridSize;
          if (Math.abs(snappedY - gridY) <= threshold) {
            snappedY = gridY;
          }
        }
      }

      // Only update state if lines changed
      if (JSON.stringify(newLines) !== JSON.stringify(linesRef.current)) {
        linesRef.current = newLines;
        setLines(newLines);
      }

      return { x: snappedX, y: snappedY };
    },
    [enabled, threshold, gridSize],
  );

  const onNodeDragStop = useCallback(() => {
    linesRef.current = [];
    setLines([]);
  }, []);

  return { lines, onNodeDrag, onNodeDragStop };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    overflow: 'visible',
    zIndex: 10,
  },
};

export default SnapGuides;
