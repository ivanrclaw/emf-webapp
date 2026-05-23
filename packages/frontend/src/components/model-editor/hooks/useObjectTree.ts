/**
 * @emf-webapp/frontend — useObjectTree
 *
 * Hook that builds a hierarchical tree structure from flat semantic objects
 * using containment references defined in the metamodel.
 */
import { useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface EClass {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: { name: string; eType?: string; lowerBound?: number; upperBound?: number }[];
  eReferences?: { name: string; eType?: string; containment?: boolean; lowerBound?: number; upperBound?: number }[];
}

export interface TreeNode {
  id: string;
  object: SemanticObject;
  children: TreeNode[];
  depth: number;
  parentId: string | null;
  containmentRef: string | null; // The reference name that contains this object
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useObjectTree(
  objects: SemanticObject[],
  eclasses: EClass[],
): TreeNode[] {
  return useMemo(() => {
    if (objects.length === 0) return [];

    // Build a map of containment references per eClass
    const containmentRefs = new Map<string, string[]>();
    for (const ec of eclasses) {
      const refs = (ec.eReferences || [])
        .filter((r) => r.containment)
        .map((r) => r.name);
      if (refs.length > 0) {
        containmentRefs.set(ec.name, refs);
      }
    }

    // Find which objects are children (contained by another object)
    const childToParent = new Map<string, { parentId: string; refName: string }>();

    for (const obj of objects) {
      const contRefs = containmentRefs.get(obj.eClass) || [];
      for (const refName of contRefs) {
        const childIds = obj.references[refName] || [];
        for (const childId of childIds) {
          childToParent.set(childId, { parentId: obj.id, refName });
        }
      }
    }

    // Build tree nodes
    const objectMap = new Map(objects.map((o) => [o.id, o]));
    const nodeMap = new Map<string, TreeNode>();

    // Create all tree nodes first
    for (const obj of objects) {
      const parentInfo = childToParent.get(obj.id);
      nodeMap.set(obj.id, {
        id: obj.id,
        object: obj,
        children: [],
        depth: 0,
        parentId: parentInfo?.parentId || null,
        containmentRef: parentInfo?.refName || null,
      });
    }

    // Build parent-child relationships
    for (const obj of objects) {
      const contRefs = containmentRefs.get(obj.eClass) || [];
      for (const refName of contRefs) {
        const childIds = obj.references[refName] || [];
        for (const childId of childIds) {
          const childNode = nodeMap.get(childId);
          const parentNode = nodeMap.get(obj.id);
          if (childNode && parentNode) {
            parentNode.children.push(childNode);
          }
        }
      }
    }

    // Calculate depths
    function setDepth(node: TreeNode, depth: number) {
      node.depth = depth;
      for (const child of node.children) {
        setDepth(child, depth + 1);
      }
    }

    // Root nodes are those without a parent
    const roots: TreeNode[] = [];
    for (const node of nodeMap.values()) {
      if (!childToParent.has(node.id)) {
        roots.push(node);
        setDepth(node, 0);
      }
    }

    // Sort roots and children alphabetically by name
    function sortNodes(nodes: TreeNode[]): TreeNode[] {
      return nodes.sort((a, b) => {
        const nameA = (a.object.attributes.name as string) || a.object.eClass;
        const nameB = (b.object.attributes.name as string) || b.object.eClass;
        return nameA.localeCompare(nameB);
      });
    }

    function sortTree(nodes: TreeNode[]): TreeNode[] {
      const sorted = sortNodes(nodes);
      for (const node of sorted) {
        if (node.children.length > 0) {
          node.children = sortTree(node.children);
        }
      }
      return sorted;
    }

    return sortTree(roots);
  }, [objects, eclasses]);
}

/**
 * Flatten the tree into a list for rendering (respecting collapsed state).
 */
export function flattenTree(
  roots: TreeNode[],
  collapsedIds: Set<string>,
): TreeNode[] {
  const result: TreeNode[] = [];

  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0 && !collapsedIds.has(node.id)) {
        walk(node.children);
      }
    }
  }

  walk(roots);
  return result;
}
