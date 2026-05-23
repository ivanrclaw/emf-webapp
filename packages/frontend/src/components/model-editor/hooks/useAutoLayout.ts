/**
 * @emf-webapp/frontend — useAutoLayout
 *
 * Auto-layout hook providing layout algorithms for the model editor canvas.
 * Supports tree (hierarchical), force-directed, and grid layout strategies.
 * All algorithms respect the `selectedOnly` option to only reposition selected nodes.
 */
import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LayoutAlgorithm = 'tree' | 'force' | 'grid';

export interface AutoLayoutOptions {
  algorithm: LayoutAlgorithm;
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  spacing?: { x: number; y: number };
  animate?: boolean;
  selectedOnly?: boolean;
}

export interface AutoLayoutResult {
  nodes: Node[];
  changed: boolean;
}

export interface UseAutoLayoutReturn {
  applyLayout: (nodes: Node[], edges: Edge[], options: AutoLayoutOptions) => AutoLayoutResult;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_SPACING = { x: 200, y: 150 };
const FORCE_ITERATIONS = 50;
const REPULSION_STRENGTH = 5000;
const ATTRACTION_STRENGTH = 0.01;
const DAMPING = 0.9;

/* ------------------------------------------------------------------ */
/*  Layout Algorithms                                                  */
/* ------------------------------------------------------------------ */

/**
 * Tree layout — BFS from root nodes (no incoming edges).
 * Assigns levels and spreads nodes horizontally within each level.
 */
function treeLayout(
  nodes: Node[],
  edges: Edge[],
  targetIds: Set<string>,
  direction: 'TB' | 'LR' | 'BT' | 'RL',
  spacing: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Build adjacency: parent -> children (based on edge direction)
  const incomingCount = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const node of nodes) {
    if (!targetIds.has(node.id)) continue;
    incomingCount.set(node.id, 0);
    children.set(node.id, []);
  }

  for (const edge of edges) {
    if (!targetIds.has(edge.source) || !targetIds.has(edge.target)) continue;
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
    const kids = children.get(edge.source) || [];
    kids.push(edge.target);
    children.set(edge.source, kids);
  }

  // Find root nodes (no incoming edges within the target set)
  const roots: string[] = [];
  for (const [id, count] of incomingCount) {
    if (count === 0) roots.push(id);
  }

  // If no roots found (cycles), pick the first node as root
  if (roots.length === 0 && targetIds.size > 0) {
    roots.push([...targetIds][0]);
  }

  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue: string[] = [...roots];
  for (const r of roots) levels.set(r, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    const kids = children.get(current) || [];
    for (const child of kids) {
      if (!levels.has(child)) {
        levels.set(child, currentLevel + 1);
        queue.push(child);
      }
    }
  }

  // Assign level 0 to any unvisited nodes (disconnected)
  for (const id of targetIds) {
    if (!levels.has(id)) levels.set(id, 0);
  }

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  for (const [id, level] of levels) {
    const group = levelGroups.get(level) || [];
    group.push(id);
    levelGroups.set(level, group);
  }

  // Compute positions based on direction
  for (const [level, group] of levelGroups) {
    for (let i = 0; i < group.length; i++) {
      const offset = i - (group.length - 1) / 2;
      let x: number;
      let y: number;

      switch (direction) {
        case 'TB':
          x = offset * spacing.x;
          y = level * spacing.y;
          break;
        case 'BT':
          x = offset * spacing.x;
          y = -level * spacing.y;
          break;
        case 'LR':
          x = level * spacing.x;
          y = offset * spacing.y;
          break;
        case 'RL':
          x = -level * spacing.x;
          y = offset * spacing.y;
          break;
      }

      positions.set(group[i], { x, y });
    }
  }

  return positions;
}

/**
 * Force-directed layout — Simple spring-embedder simulation.
 * Repulsion between all nodes, attraction along edges.
 */
function forceLayout(
  nodes: Node[],
  edges: Edge[],
  targetIds: Set<string>,
  spacing: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  // Initialize positions from current node positions
  const pos = new Map<string, { x: number; y: number }>();
  const vel = new Map<string, { x: number; y: number }>();

  const targetNodes = nodes.filter((n) => targetIds.has(n.id));

  for (const node of targetNodes) {
    pos.set(node.id, { x: node.position.x, y: node.position.y });
    vel.set(node.id, { x: 0, y: 0 });
  }

  // Filter edges to those connecting target nodes
  const relevantEdges = edges.filter(
    (e) => targetIds.has(e.source) && targetIds.has(e.target),
  );

  const idealLength = Math.max(spacing.x, spacing.y);

  // Simulation loop
  for (let iter = 0; iter < FORCE_ITERATIONS; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    for (const id of targetIds) {
      forces.set(id, { x: 0, y: 0 });
    }

    // Repulsion between all pairs
    const ids = [...targetIds];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION_STRENGTH / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const fi = forces.get(ids[i])!;
        const fj = forces.get(ids[j])!;
        fi.x += fx;
        fi.y += fy;
        fj.x -= fx;
        fj.y -= fy;
      }
    }

    // Attraction along edges
    for (const edge of relevantEdges) {
      const a = pos.get(edge.source)!;
      const b = pos.get(edge.target)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = ATTRACTION_STRENGTH * (dist - idealLength);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      const fs = forces.get(edge.source)!;
      const ft = forces.get(edge.target)!;
      fs.x += fx;
      fs.y += fy;
      ft.x -= fx;
      ft.y -= fy;
    }

    // Apply forces with damping
    for (const id of targetIds) {
      const v = vel.get(id)!;
      const f = forces.get(id)!;
      const p = pos.get(id)!;

      v.x = (v.x + f.x) * DAMPING;
      v.y = (v.y + f.y) * DAMPING;
      p.x += v.x;
      p.y += v.y;
    }
  }

  return pos;
}

/**
 * Grid layout — Arrange nodes in a grid pattern.
 * Sorted by eClass then name. Columns = ceil(sqrt(n)).
 */
function gridLayout(
  nodes: Node[],
  targetIds: Set<string>,
  spacing: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const targetNodes = nodes
    .filter((n) => targetIds.has(n.id))
    .sort((a, b) => {
      const classA = String(a.data?.eClass || a.type || '');
      const classB = String(b.data?.eClass || b.type || '');
      if (classA !== classB) return classA.localeCompare(classB);
      const nameA = String(a.data?.label || a.data?.name || a.id);
      const nameB = String(b.data?.label || b.data?.name || b.id);
      return nameA.localeCompare(nameB);
    });

  const cols = Math.ceil(Math.sqrt(targetNodes.length));

  for (let i = 0; i < targetNodes.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(targetNodes[i].id, {
      x: col * spacing.x,
      y: row * spacing.y,
    });
  }

  return positions;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAutoLayout(): UseAutoLayoutReturn {
  const applyLayout = useCallback(
    (nodes: Node[], edges: Edge[], options: AutoLayoutOptions): AutoLayoutResult => {
      const { algorithm, direction = 'TB', spacing = DEFAULT_SPACING, selectedOnly = false } = options;

      // Determine which nodes to layout
      const targetIds = new Set<string>(
        selectedOnly
          ? nodes.filter((n) => n.selected).map((n) => n.id)
          : nodes.map((n) => n.id),
      );

      if (targetIds.size === 0) {
        return { nodes, changed: false };
      }

      // Compute new positions based on algorithm
      let newPositions: Map<string, { x: number; y: number }>;

      switch (algorithm) {
        case 'tree':
          newPositions = treeLayout(nodes, edges, targetIds, direction, spacing);
          break;
        case 'force':
          newPositions = forceLayout(nodes, edges, targetIds, spacing);
          break;
        case 'grid':
          newPositions = gridLayout(nodes, targetIds, spacing);
          break;
      }

      // Apply positions to nodes
      let changed = false;
      const updatedNodes = nodes.map((node) => {
        const newPos = newPositions.get(node.id);
        if (!newPos) return node;

        if (node.position.x !== newPos.x || node.position.y !== newPos.y) {
          changed = true;
          return { ...node, position: { x: newPos.x, y: newPos.y } };
        }
        return node;
      });

      return { nodes: updatedNodes, changed };
    },
    [],
  );

  return { applyLayout };
}
