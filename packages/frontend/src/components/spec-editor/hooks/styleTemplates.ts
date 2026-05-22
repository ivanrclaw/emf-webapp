/**
 * Predefined style templates for quick spec generation.
 * Each template provides a complete style palette for nodes and edges.
 */
import type { NodeStyle, EdgeStyleSpec } from '../../spec-diagram/types';

export interface StyleTemplate {
  id: string;
  name: string;
  description: string;
  nodeColors: string[];
  nodeStyle: Partial<NodeStyle>;
  edgeStyle: Partial<EdgeStyleSpec>;
}

export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 'uml',
    name: 'UML',
    description: 'Classic UML class diagram style',
    nodeColors: ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#e0e7ff', '#f3e8ff'],
    nodeStyle: {
      shape: 'rectangle',
      borderSize: 2,
      borderLineStyle: 'solid',
      borderColor: '#374151',
      labelColor: '#111827',
      labelSize: 12,
      labelPosition: 'inside',
      labelBold: true,
      labelItalic: false,
    },
    edgeStyle: {
      lineStyle: 'solid',
      lineWidth: 1,
      color: '#374151',
      sourceDecoration: 'none',
      targetDecoration: 'arrow',
      routingStyle: 'manhattan',
      labelColor: '#374151',
      labelSize: 10,
    },
  },
  {
    id: 'er',
    name: 'ER Diagram',
    description: 'Entity-Relationship style with rounded shapes',
    nodeColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    nodeStyle: {
      shape: 'rounded-rectangle',
      borderSize: 0,
      borderLineStyle: 'solid',
      borderColor: 'transparent',
      labelColor: '#ffffff',
      labelSize: 13,
      labelPosition: 'inside',
      labelBold: true,
      labelItalic: false,
    },
    edgeStyle: {
      lineStyle: 'solid',
      lineWidth: 2,
      color: '#6b7280',
      sourceDecoration: 'none',
      targetDecoration: 'filled-diamond',
      routingStyle: 'manhattan',
      labelColor: '#6b7280',
      labelSize: 10,
    },
  },
  {
    id: 'bpmn',
    name: 'BPMN',
    description: 'Business process style with events and activities',
    nodeColors: ['#dbeafe', '#fef3c7', '#dcfce7', '#fce7f3', '#e0e7ff', '#f3e8ff'],
    nodeStyle: {
      shape: 'rounded-rectangle',
      borderSize: 2,
      borderLineStyle: 'solid',
      borderColor: '#2563eb',
      labelColor: '#1e3a5f',
      labelSize: 11,
      labelPosition: 'inside',
      labelBold: false,
      labelItalic: false,
    },
    edgeStyle: {
      lineStyle: 'solid',
      lineWidth: 2,
      color: '#2563eb',
      sourceDecoration: 'none',
      targetDecoration: 'filled-triangle',
      routingStyle: 'manhattan',
      labelColor: '#2563eb',
      labelSize: 10,
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, minimal dark theme',
    nodeColors: ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316'],
    nodeStyle: {
      shape: 'rounded-rectangle',
      borderSize: 0,
      borderLineStyle: 'solid',
      borderColor: 'transparent',
      labelColor: '#ffffff',
      labelSize: 12,
      labelPosition: 'inside',
      labelBold: false,
      labelItalic: false,
    },
    edgeStyle: {
      lineStyle: 'solid',
      lineWidth: 2,
      color: '#6366f1',
      sourceDecoration: 'none',
      targetDecoration: 'arrow',
      routingStyle: 'straight',
      labelColor: '#a1a1aa',
      labelSize: 10,
    },
  },
];

/**
 * Apply a template to all mappings in a layer, cycling through colors.
 */
export function applyTemplate(
  template: StyleTemplate,
  nodeMappings: { id: string; defaultStyle: NodeStyle }[],
  edgeMappings: { id: string; defaultStyle: EdgeStyleSpec }[],
): {
  nodePatches: { id: string; style: NodeStyle }[];
  edgePatches: { id: string; style: EdgeStyleSpec }[];
} {
  const nodePatches = nodeMappings.map((nm, idx) => ({
    id: nm.id,
    style: {
      ...nm.defaultStyle,
      ...template.nodeStyle,
      color: template.nodeColors[idx % template.nodeColors.length],
    } as NodeStyle,
  }));

  const edgePatches = edgeMappings.map((em) => ({
    id: em.id,
    style: {
      ...em.defaultStyle,
      ...template.edgeStyle,
    } as EdgeStyleSpec,
  }));

  return { nodePatches, edgePatches };
}
