/**
 * @emf-webapp/frontend — EdgeLayoutContext
 *
 * Minimal context that provides no-op routing functions.
 * Edge routing is handled by React Flow's built-in edge types (smoothstep).
 */
import React, { createContext, useContext } from 'react';
import { type Node, type Edge, type NodeChange } from '@xyflow/react';

export interface EdgeLayoutData {
  updateRoutingOnNodesChange: (changes: NodeChange<Node>[]) => void;
  resetRouting: () => void;
  refreshRouting: () => void;
}

const NOOP_LAYOUT: EdgeLayoutData = {
  updateRoutingOnNodesChange: () => {},
  resetRouting: () => {},
  refreshRouting: () => {},
};

const EdgeLayoutCtx = createContext<EdgeLayoutData>(NOOP_LAYOUT);

interface EdgeLayoutProviderProps {
  nodes: Node[];
  edges: Edge[];
  children: React.ReactNode;
}

export function EdgeLayoutProvider({ children }: EdgeLayoutProviderProps) {
  return (
    <EdgeLayoutCtx.Provider value={NOOP_LAYOUT}>
      {children}
    </EdgeLayoutCtx.Provider>
  );
}

export function useEdgeLayout(): EdgeLayoutData {
  return useContext(EdgeLayoutCtx);
}
