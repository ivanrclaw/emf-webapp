/**
 * MappingPreview — Right panel with a ReactFlow canvas
 * showing a live preview of the currently selected mapping.
 *
 * Features:
 * - Node/Edge/Container preview with real styles
 * - Full Preview: all mappings rendered together
 * - Diagram Preview: dummy instances from metamodel with mappings applied
 * - Dark/Light background toggle
 * - Randomize button for diagram preview
 * - Missing mappings indicator
 */
import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import SpecNode, { type SpecNodeData } from '../spec-diagram/SpecNode';
import SpecContainerNode, { type SpecContainerNodeData } from '../spec-diagram/SpecContainerNode';
import SpecEdge, { type SpecEdgeData } from '../spec-diagram/SpecEdge';
import type {
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
} from '../spec-diagram/types';
import { createDefaultNodeStyle } from '../spec-diagram/types';
import type { MappingSelection } from './MappingNavigator';
import { Eye, Sun, Moon, Layers, RefreshCw, AlertTriangle } from '../icons';

// ─── Node/Edge type registries ────────────────────────────────────────────────

const nodeTypes = {
  specNode: SpecNode,
  specContainerNode: SpecContainerNode,
} as any;
const edgeTypes = { specEdge: SpecEdge } as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface EClassInfo {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: { name: string; eType?: string }[];
  eReferences?: { name: string; eType?: string; containment?: boolean; upperBound?: number }[];
}

interface MappingPreviewProps {
  selection: MappingSelection | null;
  layer: Layer;
  eclasses: EClassInfo[];
}

type PreviewMode = 'selection' | 'full' | 'diagram';

// ─── Component ────────────────────────────────────────────────────────────────

export function MappingPreview({ selection, layer, eclasses }: MappingPreviewProps) {
  const [darkBg, setDarkBg] = useState(true);
  const [mode, setMode] = useState<PreviewMode>('selection');
  const [randomSeed, setRandomSeed] = useState(0);

  const { nodes, edges } = useMemo(() => {
    switch (mode) {
      case 'full':
        return buildFullPreview(layer);
      case 'diagram':
        return buildDiagramPreview(layer, eclasses, randomSeed);
      case 'selection':
      default:
        if (!selection) return { nodes: [], edges: [] };
        switch (selection.type) {
          case 'node': {
            const mapping = layer.nodeMappings.find((m) => m.id === selection.id);
            if (!mapping) return { nodes: [], edges: [] };
            return buildNodePreview(mapping, layer);
          }
          case 'container': {
            const mapping = layer.containerMappings.find((m) => m.id === selection.id);
            if (!mapping) return { nodes: [], edges: [] };
            return buildContainerPreview(mapping, layer);
          }
          case 'edge': {
            const mapping = layer.edgeMappings.find((m) => m.id === selection.id);
            if (!mapping) return { nodes: [], edges: [] };
            return buildEdgePreview(mapping, layer);
          }
          default:
            return { nodes: [], edges: [] };
        }
    }
  }, [selection, layer, mode, eclasses, randomSeed]);

  // Missing mappings: concrete classes without a node/container mapping
  const missingMappings = useMemo(() => {
    const mapped = new Set([
      ...layer.nodeMappings.map((m) => m.domainClass),
      ...layer.containerMappings.map((m) => m.domainClass),
    ]);
    return eclasses
      .filter((ec) => !ec.abstract && !ec.interface && !mapped.has(ec.name))
      .map((ec) => ec.name);
  }, [eclasses, layer]);

  const hasContent = nodes.length > 0 || edges.length > 0;
  const bgColor = darkBg ? '#1a1a2e' : '#f8fafc';
  const dotColor = darkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <Eye size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={styles.headerLabel}>
          {mode === 'diagram' ? 'Diagram' : mode === 'full' ? 'All Mappings' : 'Preview'}
        </span>
        <div style={{ flex: 1 }} />
        {/* Mode buttons */}
        <button
          onClick={() => setMode('selection')}
          style={{ ...styles.toggleBtn, ...(mode === 'selection' ? styles.toggleBtnActive : {}) }}
          title="Preview selected mapping"
        >
          <Eye size={11} />
        </button>
        <button
          onClick={() => setMode('full')}
          style={{ ...styles.toggleBtn, ...(mode === 'full' ? styles.toggleBtnActive : {}) }}
          title="Show all mappings"
        >
          <Layers size={11} />
        </button>
        <button
          onClick={() => setMode('diagram')}
          style={{ ...styles.toggleBtn, ...(mode === 'diagram' ? styles.toggleBtnActive : {}) }}
          title="Diagram preview with dummy data"
        >
          D
        </button>
        <div style={styles.separator} />
        {/* Randomize (only in diagram mode) */}
        {mode === 'diagram' && (
          <button
            onClick={() => setRandomSeed((s) => s + 1)}
            style={styles.toggleBtn}
            title="Randomize data"
          >
            <RefreshCw size={11} />
          </button>
        )}
        {/* Dark/Light toggle */}
        <button
          onClick={() => setDarkBg(!darkBg)}
          style={styles.toggleBtn}
          title={darkBg ? 'Light background' : 'Dark background'}
        >
          {darkBg ? <Sun size={11} /> : <Moon size={11} />}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ ...styles.canvas, background: bgColor }}>
        {!hasContent ? (
          <div style={styles.emptyState}>
            <Eye size={20} style={{ opacity: 0.3, color: 'var(--text-muted)' }} />
            <div style={styles.emptyDesc}>
              {mode === 'diagram'
                ? 'No mappings to generate diagram'
                : mode === 'full'
                ? 'No mappings defined'
                : 'Select a mapping to preview'}
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color={dotColor}
            />
          </ReactFlow>
        )}
      </div>

      {/* Info bar */}
      <div style={styles.infoBar}>
        {hasContent && (
          <span style={styles.infoText}>
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
            {edges.length > 0 && ` · ${edges.length} edge${edges.length !== 1 ? 's' : ''}`}
          </span>
        )}
        {missingMappings.length > 0 && (
          <span style={styles.warningText} title={`Unmapped: ${missingMappings.join(', ')}`}>
            <AlertTriangle size={10} />
            {missingMappings.length} unmapped class{missingMappings.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Preview Builders ─────────────────────────────────────────────────────────

function buildNodePreview(mapping: NodeMapping, layer: Layer): { nodes: Node[]; edges: Edge[] } {
  const mainNode: Node = {
    id: 'preview-main',
    type: 'specNode',
    position: { x: 120, y: 60 },
    data: { mapping, selected: false } as SpecNodeData,
  };

  const connectedEdges = layer.edgeMappings.filter(
    (em) => em.sourceMappingIds.includes(mapping.id) || em.targetMappingIds.includes(mapping.id)
  );

  const contextNodes: Node[] = [];
  const contextEdges: Edge[] = [];

  let contextIdx = 0;
  for (const em of connectedEdges.slice(0, 2)) {
    const isSource = em.sourceMappingIds.includes(mapping.id);
    const targetIds = isSource ? em.targetMappingIds : em.sourceMappingIds;
    const targetMapping = layer.nodeMappings.find((m) => targetIds.includes(m.id))
      || layer.containerMappings.find((m) => targetIds.includes(m.id));

    if (targetMapping && targetMapping.id !== mapping.id) {
      const nodeId = `context-${contextIdx}`;
      const xPos = contextIdx === 0 ? 40 : 220;
      contextNodes.push({
        id: nodeId,
        type: 'specNode',
        position: { x: xPos, y: 180 },
        data: { mapping: { ...targetMapping, defaultStyle: { ...targetMapping.defaultStyle, color: dimColor(targetMapping.defaultStyle.color) } }, selected: false } as SpecNodeData,
      });
      contextEdges.push({
        id: `edge-ctx-${contextIdx}`,
        source: isSource ? 'preview-main' : nodeId,
        target: isSource ? nodeId : 'preview-main',
        type: 'specEdge',
        data: { edgeMapping: em, selected: false } as SpecEdgeData,
      });
      contextIdx++;
    }
  }

  if (contextNodes.length === 0) {
    const ghostStyle = createDefaultNodeStyle();
    ghostStyle.color = '#374151';
    ghostStyle.borderColor = '#4b5563';
    ghostStyle.labelColor = '#9ca3af';

    contextNodes.push(
      { id: 'ghost-1', type: 'specNode', position: { x: 40, y: 190 }, data: { mapping: { id: 'g1', domainClass: 'Related', semanticCandidatesExpression: 'self', labelExpression: 'Related', defaultStyle: ghostStyle, conditionalStyles: [] }, selected: false } as SpecNodeData },
      { id: 'ghost-2', type: 'specNode', position: { x: 220, y: 190 }, data: { mapping: { id: 'g2', domainClass: 'Other', semanticCandidatesExpression: 'self', labelExpression: 'Other', defaultStyle: ghostStyle, conditionalStyles: [] }, selected: false } as SpecNodeData },
    );
    contextEdges.push(
      { id: 'ge1', source: 'preview-main', target: 'ghost-1', type: 'smoothstep', style: { stroke: '#4b5563', strokeWidth: 1, opacity: 0.4 } },
      { id: 'ge2', source: 'preview-main', target: 'ghost-2', type: 'smoothstep', style: { stroke: '#4b5563', strokeWidth: 1, opacity: 0.4 } },
    );
  }

  return { nodes: [mainNode, ...contextNodes], edges: contextEdges };
}

function buildContainerPreview(mapping: ContainerMapping, layer: Layer): { nodes: Node[]; edges: Edge[] } {
  const mainNode: Node = {
    id: 'preview-container',
    type: 'specContainerNode',
    position: { x: 60, y: 40 },
    data: { mapping, selected: false } as SpecContainerNodeData,
  };

  const childNodes: Node[] = [];
  const childMappings = mapping.subNodeMappingIds
    .map((id) => layer.nodeMappings.find((m) => m.id === id))
    .filter(Boolean) as NodeMapping[];

  childMappings.slice(0, 3).forEach((cm, idx) => {
    const childStyle = { ...cm.defaultStyle, width: Math.min(cm.defaultStyle.width || 100, 80), height: Math.min(cm.defaultStyle.height || 40, 35), labelSize: Math.min(cm.defaultStyle.labelSize, 10) };
    childNodes.push({
      id: `child-${idx}`,
      type: 'specNode',
      position: { x: 80 + idx * 100, y: 160 },
      data: { mapping: { ...cm, defaultStyle: childStyle }, selected: false } as SpecNodeData,
    });
  });

  if (childNodes.length === 0) {
    const placeholderStyle = createDefaultNodeStyle();
    placeholderStyle.color = '#4b5563';
    placeholderStyle.borderColor = '#6b7280';
    placeholderStyle.labelColor = '#9ca3af';
    placeholderStyle.width = 70;
    placeholderStyle.height = 30;
    placeholderStyle.labelSize = 9;

    for (let i = 0; i < 2; i++) {
      childNodes.push({
        id: `placeholder-${i}`,
        type: 'specNode',
        position: { x: 80 + i * 90, y: 160 },
        data: { mapping: { id: `ph${i}`, domainClass: `Child ${i + 1}`, semanticCandidatesExpression: 'self', labelExpression: `Child ${i + 1}`, defaultStyle: placeholderStyle, conditionalStyles: [] }, selected: false } as SpecNodeData,
      });
    }
  }

  return { nodes: [mainNode, ...childNodes], edges: [] };
}

function buildEdgePreview(mapping: EdgeMapping, layer: Layer): { nodes: Node[]; edges: Edge[] } {
  const sourceMapping = layer.nodeMappings.find((m) => mapping.sourceMappingIds.includes(m.id))
    || layer.containerMappings.find((m) => mapping.sourceMappingIds.includes(m.id));
  const targetMapping = layer.nodeMappings.find((m) => mapping.targetMappingIds.includes(m.id))
    || layer.containerMappings.find((m) => mapping.targetMappingIds.includes(m.id));

  const defaultStyle = createDefaultNodeStyle();
  defaultStyle.color = '#374151';
  defaultStyle.borderColor = '#4b5563';
  defaultStyle.labelColor = '#d1d5db';

  const sourceNode: Node = {
    id: 'preview-source',
    type: 'specNode',
    position: { x: 30, y: 80 },
    data: { mapping: sourceMapping || { id: 'src', domainClass: 'Source', semanticCandidatesExpression: 'self', labelExpression: 'Source', defaultStyle, conditionalStyles: [] }, selected: false } as SpecNodeData,
  };

  const targetNode: Node = {
    id: 'preview-target',
    type: 'specNode',
    position: { x: 250, y: 80 },
    data: { mapping: targetMapping || { id: 'tgt', domainClass: 'Target', semanticCandidatesExpression: 'self', labelExpression: 'Target', defaultStyle, conditionalStyles: [] }, selected: false } as SpecNodeData,
  };

  const edge: Edge = {
    id: 'preview-edge',
    source: 'preview-source',
    target: 'preview-target',
    type: 'specEdge',
    data: { edgeMapping: mapping, selected: false } as SpecEdgeData,
  };

  return { nodes: [sourceNode, targetNode], edges: [edge] };
}

function buildFullPreview(layer: Layer): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cols = 3;
  const spacingX = 200;
  const spacingY = 140;

  let idx = 0;
  for (const nm of layer.nodeMappings) {
    nodes.push({
      id: nm.id,
      type: 'specNode',
      position: { x: 40 + (idx % cols) * spacingX, y: 40 + Math.floor(idx / cols) * spacingY },
      data: { mapping: nm, selected: false } as SpecNodeData,
    });
    idx++;
  }
  for (const cm of layer.containerMappings) {
    nodes.push({
      id: cm.id,
      type: 'specContainerNode',
      position: { x: 40 + (idx % cols) * spacingX, y: 40 + Math.floor(idx / cols) * spacingY },
      data: { mapping: cm, selected: false } as SpecContainerNodeData,
    });
    idx++;
  }
  for (const em of layer.edgeMappings) {
    const sourceId = em.sourceMappingIds[0];
    const targetId = em.targetMappingIds[0];
    if (sourceId && targetId && nodes.some((n) => n.id === sourceId) && nodes.some((n) => n.id === targetId)) {
      edges.push({
        id: em.id,
        source: sourceId,
        target: targetId,
        type: 'specEdge',
        data: { edgeMapping: em, selected: false } as SpecEdgeData,
      });
    }
  }

  return { nodes, edges };
}

// ─── Diagram Preview (dummy instances) ────────────────────────────────────────

const DUMMY_NAMES: Record<string, string[]> = {
  default: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'],
  Person: ['Alice', 'Bob', 'Charlie', 'Diana'],
  Employee: ['John', 'Jane', 'Mike', 'Sarah'],
  Department: ['Engineering', 'Marketing', 'Sales', 'HR'],
  Project: ['Phoenix', 'Atlas', 'Nova', 'Titan'],
  Company: ['Acme Corp', 'TechCo', 'DataInc'],
  Package: ['core', 'utils', 'api', 'ui'],
  Class: ['Person', 'Order', 'Product', 'Account'],
  Interface: ['Serializable', 'Comparable', 'Iterable'],
  Attribute: ['name', 'age', 'email', 'id'],
  Reference: ['parent', 'children', 'owner', 'items'],
};

function getDummyName(className: string, index: number, seed: number): string {
  const names = DUMMY_NAMES[className] || DUMMY_NAMES.default;
  const idx = (index + seed) % names.length;
  return names[idx];
}

function buildDiagramPreview(
  layer: Layer,
  eclasses: EClassInfo[],
  seed: number,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // For each node mapping, create 1-3 dummy instances
  const instanceMap = new Map<string, string[]>(); // mappingId → [nodeId, ...]
  const cols = 4;
  const spacingX = 170;
  const spacingY = 120;
  let globalIdx = 0;

  // Determine instance count based on seed
  const getInstanceCount = (mappingIdx: number) => {
    const counts = [2, 3, 1, 2, 3, 2, 1, 3];
    return counts[(mappingIdx + seed) % counts.length];
  };

  // Create instances for node mappings
  for (let mi = 0; mi < layer.nodeMappings.length; mi++) {
    const nm = layer.nodeMappings[mi];
    const count = getInstanceCount(mi);
    const ids: string[] = [];

    for (let i = 0; i < count; i++) {
      const nodeId = `inst_${nm.id}_${i}`;
      ids.push(nodeId);
      const label = getDummyName(nm.domainClass, i, seed);

      // Create a mapping copy with the dummy label
      const instanceMapping: NodeMapping = {
        ...nm,
        id: nodeId,
        labelExpression: label,
      };

      nodes.push({
        id: nodeId,
        type: 'specNode',
        position: {
          x: 30 + (globalIdx % cols) * spacingX,
          y: 30 + Math.floor(globalIdx / cols) * spacingY,
        },
        data: { mapping: instanceMapping, selected: false } as SpecNodeData,
      });
      globalIdx++;
    }
    instanceMap.set(nm.id, ids);
  }

  // Create instances for container mappings
  for (let mi = 0; mi < layer.containerMappings.length; mi++) {
    const cm = layer.containerMappings[mi];
    const nodeId = `inst_${cm.id}_0`;
    const label = getDummyName(cm.domainClass, 0, seed);
    instanceMap.set(cm.id, [nodeId]);

    const instanceMapping: ContainerMapping = {
      ...cm,
      id: nodeId,
      labelExpression: label,
    };

    nodes.push({
      id: nodeId,
      type: 'specContainerNode',
      position: {
        x: 30 + (globalIdx % cols) * spacingX,
        y: 30 + Math.floor(globalIdx / cols) * spacingY,
      },
      data: { mapping: instanceMapping, selected: false } as SpecContainerNodeData,
    });
    globalIdx++;
  }

  // Create edges between instances based on edge mappings
  let edgeIdx = 0;
  for (const em of layer.edgeMappings) {
    const sourceInstances = em.sourceMappingIds.flatMap((id) => instanceMap.get(id) || []);
    const targetInstances = em.targetMappingIds.flatMap((id) => instanceMap.get(id) || []);

    if (sourceInstances.length === 0 || targetInstances.length === 0) continue;

    // Connect each source to a target (round-robin)
    for (let si = 0; si < sourceInstances.length; si++) {
      const targetIdx = (si + seed) % targetInstances.length;
      const sourceId = sourceInstances[si];
      const targetId = targetInstances[targetIdx];

      // Avoid self-loops
      if (sourceId === targetId) continue;

      edges.push({
        id: `dedge_${edgeIdx++}`,
        source: sourceId,
        target: targetId,
        type: 'specEdge',
        data: { edgeMapping: em, selected: false } as SpecEdgeData,
      });
    }
  }

  return { nodes, edges };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dimColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dim = (v: number) => Math.round(v * 0.6 + 40);
    return `#${dim(r).toString(16).padStart(2, '0')}${dim(g).toString(16).padStart(2, '0')}${dim(b).toString(16).padStart(2, '0')}`;
  } catch {
    return '#4b5563';
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 8px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginRight: '4px',
  },
  separator: {
    width: '1px',
    height: '14px',
    background: 'var(--border)',
    margin: '0 2px',
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: 0,
    fontSize: '10px',
    fontWeight: 700,
    transition: 'border-color 0.15s, color 0.15s, background 0.15s',
  },
  toggleBtnActive: {
    borderColor: 'var(--primary)',
    color: 'var(--primary)',
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.12))',
  },
  canvas: {
    flex: 1,
    position: 'relative',
    transition: 'background 0.2s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '6px',
    padding: '24px',
  },
  emptyDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  infoBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 10px',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0,
    minHeight: '22px',
  },
  infoText: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  warningText: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '10px',
    color: 'var(--warning, #f59e0b)',
    cursor: 'help',
  },
};

export default MappingPreview;
