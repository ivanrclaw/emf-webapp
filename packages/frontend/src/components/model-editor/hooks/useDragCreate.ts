/**
 * @emf-webapp/frontend — useDragCreate
 *
 * Hook for drag-and-drop creation from palette to canvas.
 * Manages drag state, ghost preview, and drop position calculation.
 */
import { useState, useCallback, useRef } from 'react';
import type { NodeCreationTool, ContainerCreationTool } from '../../spec-diagram/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DragState {
  tool: NodeCreationTool | ContainerCreationTool;
  position: { x: number; y: number };
  active: boolean;
}

interface UseDragCreateReturn {
  dragState: DragState | null;
  onDragStart: (e: React.DragEvent, tool: NodeCreationTool | ContainerCreationTool) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }) => { tool: NodeCreationTool | ContainerCreationTool; position: { x: number; y: number } } | null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDragCreate(): UseDragCreateReturn {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const toolRef = useRef<NodeCreationTool | ContainerCreationTool | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, tool: NodeCreationTool | ContainerCreationTool) => {
    toolRef.current = tool;
    // Set drag data for ReactFlow compatibility
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ toolId: tool.id }));
    e.dataTransfer.effectAllowed = 'move';

    setDragState({
      tool,
      position: { x: e.clientX, y: e.clientY },
      active: true,
    });
  }, []);

  const onDragEnd = useCallback(() => {
    setDragState(null);
    toolRef.current = null;
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (toolRef.current) {
      setDragState((prev) => prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null);
    }
  }, []);

  const onDrop = useCallback((
    e: React.DragEvent,
    screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
  ) => {
    e.preventDefault();
    const tool = toolRef.current;
    if (!tool) return null;

    // Calculate the flow position from the drop coordinates
    const reactFlowBounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    if (!reactFlowBounds) return null;

    const position = screenToFlowPosition({
      x: e.clientX - reactFlowBounds.left,
      y: e.clientY - reactFlowBounds.top,
    });

    setDragState(null);
    toolRef.current = null;

    return { tool, position };
  }, []);

  return { dragState, onDragStart, onDragEnd, onDragOver, onDrop };
}
