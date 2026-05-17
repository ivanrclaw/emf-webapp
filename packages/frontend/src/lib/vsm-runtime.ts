/**
 * @emf-webapp/frontend — VSM Runtime Constraint Engine
 *
 * Enforces viewpoint specification constraints at runtime:
 * - Tool preconditions (can a tool be used in a given context?)
 * - Edge creation validity (source/target mapping compatibility)
 * - Delete/direct-edit capability checks
 * - Style resolution (default + conditional styles)
 * - Active layer collection (mappings, tools, tool sections)
 */

import { evaluatePredicate } from './expression-engine';
import type {
  Tool,
  NodeCreationTool,
  ContainerCreationTool,
  EdgeCreationTool,
  DeleteTool,
  DirectEditTool,
  ToolSection,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
  NodeStyle,
  EdgeStyleSpec,
  ViewpointSpec,
} from '../components/spec-diagram/types';

// ─── Tool Precondition Checks ─────────────────────────────────────────────────

/**
 * Check if a tool can be used given the current context.
 * Evaluates the tool's preconditionExpression against context.self.
 * Tools without a precondition are always usable.
 */
export function canUseTool(
  tool: Tool,
  context: { self: Record<string, unknown> },
): boolean {
  const precondition = (tool as NodeCreationTool | ContainerCreationTool | EdgeCreationTool)
    .preconditionExpression;
  if (!precondition) return true;
  return evaluatePredicate(precondition, { self: context.self });
}

/**
 * Check if an edge can be created between a source and target node.
 * Validates that:
 * 1. The tool's edgeMappingId matches the given edgeMapping
 * 2. The source node's mapping is in the edgeMapping's sourceMappingIds
 * 3. The target node's mapping is in the edgeMapping's targetMappingIds
 * 4. The tool's precondition (if any) passes
 */
export function canCreateEdge(
  tool: EdgeCreationTool,
  edgeMapping: EdgeMapping,
  sourceNodeMappingId: string,
  targetNodeMappingId: string,
): boolean {
  // Tool must reference this edge mapping
  if (tool.edgeMappingId !== edgeMapping.id) return false;

  // Source mapping must be allowed
  if (!edgeMapping.sourceMappingIds.includes(sourceNodeMappingId)) return false;

  // Target mapping must be allowed
  if (!edgeMapping.targetMappingIds.includes(targetNodeMappingId)) return false;

  return true;
}

// ─── Delete / Direct Edit Checks ──────────────────────────────────────────────

/**
 * Check if a node (identified by its mappingId) can be deleted.
 * A node is deletable if there exists a DeleteTool whose mappingIds includes it.
 */
export function canDelete(mappingId: string, tools: Tool[]): boolean {
  return tools.some(
    (t) => t.type === 'delete' && (t as DeleteTool).mappingIds.includes(mappingId),
  );
}

/**
 * Check if a node (identified by its mappingId) supports direct editing.
 * A node supports direct edit if there exists a DirectEditTool whose mappingIds includes it.
 */
export function canDirectEdit(mappingId: string, tools: Tool[]): boolean {
  return tools.some(
    (t) => t.type === 'directEdit' && (t as DirectEditTool).mappingIds.includes(mappingId),
  );
}

/**
 * Get the DirectEditTool for a given mapping, or undefined if none exists.
 */
export function getDirectEditTool(
  mappingId: string,
  tools: Tool[],
): DirectEditTool | undefined {
  return tools.find(
    (t) => t.type === 'directEdit' && (t as DirectEditTool).mappingIds.includes(mappingId),
  ) as DirectEditTool | undefined;
}

// ─── Style Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the effective style for a node by applying conditional styles
 * on top of the default style. Conditional styles are evaluated in order;
 * the first matching predicate's partial style is merged over the default.
 * If multiple conditionals match, they are all merged in order.
 */
export function resolveNodeStyle(
  mapping: NodeMapping,
  semanticData: Record<string, unknown>,
): NodeStyle {
  let style = { ...mapping.defaultStyle };

  for (const conditional of mapping.conditionalStyles) {
    if (evaluatePredicate(conditional.predicateExpression, { self: semanticData })) {
      style = { ...style, ...conditional.style };
    }
  }

  return style;
}

/**
 * Resolve the effective style for an edge by applying conditional styles.
 * Context provides source and target semantic data for predicate evaluation.
 * The predicate is evaluated with `self` set to a combined context object
 * containing `source` and `target` properties.
 */
export function resolveEdgeStyle(
  mapping: EdgeMapping,
  context: { source?: Record<string, unknown>; target?: Record<string, unknown> },
): EdgeStyleSpec {
  let style = { ...mapping.defaultStyle };

  const evalContext = {
    source: context.source ?? {},
    target: context.target ?? {},
    ...(context.source ?? {}),
  };

  for (const conditional of mapping.conditionalStyles) {
    if (evaluatePredicate(conditional.predicateExpression, { self: evalContext })) {
      style = { ...style, ...conditional.style };
    }
  }

  return style;
}

// ─── Active Layer Collection ──────────────────────────────────────────────────

/**
 * Collect all tools from the default layer and any active additional layers.
 */
export function collectActiveTools(
  spec: ViewpointSpec,
  activeLayers: Set<string>,
): Tool[] {
  const tools: Tool[] = [];

  // Default layer tools are always included
  for (const section of spec.defaultLayer.toolSections) {
    tools.push(...section.tools);
  }

  // Additional layers that are active
  for (const layer of spec.additionalLayers) {
    if (activeLayers.has(layer.id)) {
      for (const section of layer.toolSections) {
        tools.push(...section.tools);
      }
    }
  }

  return tools;
}

/**
 * Collect all tool sections from the default layer and any active additional layers.
 */
export function collectActiveToolSections(
  spec: ViewpointSpec,
  activeLayers: Set<string>,
): ToolSection[] {
  const sections: ToolSection[] = [];

  sections.push(...spec.defaultLayer.toolSections);

  for (const layer of spec.additionalLayers) {
    if (activeLayers.has(layer.id)) {
      sections.push(...layer.toolSections);
    }
  }

  return sections;
}

/**
 * Collect all node, container, and edge mappings from the default layer
 * and any active additional layers.
 */
export function collectActiveMappings(
  spec: ViewpointSpec,
  activeLayers: Set<string>,
): {
  nodeMappings: NodeMapping[];
  containerMappings: ContainerMapping[];
  edgeMappings: EdgeMapping[];
} {
  const nodeMappings: NodeMapping[] = [...spec.defaultLayer.nodeMappings];
  const containerMappings: ContainerMapping[] = [...spec.defaultLayer.containerMappings];
  const edgeMappings: EdgeMapping[] = [...spec.defaultLayer.edgeMappings];

  for (const layer of spec.additionalLayers) {
    if (activeLayers.has(layer.id)) {
      nodeMappings.push(...layer.nodeMappings);
      containerMappings.push(...layer.containerMappings);
      edgeMappings.push(...layer.edgeMappings);
    }
  }

  return { nodeMappings, containerMappings, edgeMappings };
}
