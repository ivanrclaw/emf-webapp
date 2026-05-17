/**
 * @emf-webapp/frontend — Spec Generator
 *
 * Auto-generates a sensible default ViewpointSpec from a metamodel.
 * Creates one NodeMapping per concrete EClass, one EdgeMapping per EReference,
 * and corresponding creation tools.
 */
import type {
  ViewpointSpec,
  Layer,
  NodeMapping,
  EdgeMapping,
  NodeCreationTool,
  EdgeCreationTool,
  DeleteTool,
  DirectEditTool,
  ToolSection,
  NodeStyle,
  EdgeStyleSpec,
} from '../components/spec-diagram/types';
import { createDefaultNodeStyle, createDefaultEdgeStyle, createDefaultLayer } from '../components/spec-diagram/types';

/* ─── Color Palette ─────────────────────────────────────────────────────────── */

const NODE_COLORS = [
  { color: '#6366f1', border: '#818cf8' }, // indigo
  { color: '#8b5cf6', border: '#a78bfa' }, // violet
  { color: '#06b6d4', border: '#22d3ee' }, // cyan
  { color: '#10b981', border: '#34d399' }, // emerald
  { color: '#f59e0b', border: '#fbbf24' }, // amber
  { color: '#ef4444', border: '#f87171' }, // red
  { color: '#ec4899', border: '#f472b6' }, // pink
  { color: '#14b8a6', border: '#2dd4bf' }, // teal
  { color: '#f97316', border: '#fb923c' }, // orange
  { color: '#84cc16', border: '#a3e635' }, // lime
];

const EDGE_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ─── Metamodel Types (simplified for generator input) ──────────────────────── */

export interface MetamodelClass {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: { name: string; eType?: string; type?: string }[];
  eReferences?: {
    name: string;
    targetId?: string;
    containment?: boolean;
    upperBound?: number;
  }[];
}

export interface MetamodelInput {
  name: string;
  nsURI?: string;
  eClassifiers: MetamodelClass[];
}

/* ─── Generator ─────────────────────────────────────────────────────────────── */

export function generateViewpointSpec(metamodel: MetamodelInput, metamodelId: string): ViewpointSpec {
  const concreteClasses = metamodel.eClassifiers.filter(
    (c) => !c.abstract && !c.interface,
  );
  const allClasses = metamodel.eClassifiers;

  // Build node mappings for concrete classes
  const nodeMappings: NodeMapping[] = concreteClasses.map((cls, i) => {
    const colorIdx = i % NODE_COLORS.length;
    const style: NodeStyle = {
      ...createDefaultNodeStyle(),
      color: NODE_COLORS[colorIdx].color,
      borderColor: NODE_COLORS[colorIdx].border,
    };

    return {
      id: `nm_${uid()}`,
      domainClass: cls.name,
      semanticCandidatesExpression: 'self',
      labelExpression: 'self.name',
      defaultStyle: style,
      conditionalStyles: [],
    };
  });

  // Build edge mappings from EReferences
  const edgeMappings: EdgeMapping[] = [];
  for (const cls of allClasses) {
    for (const ref of cls.eReferences || []) {
      if (!ref.targetId) continue;

      // Find source and target node mappings
      const sourceMappingIds = nodeMappings
        .filter((nm) => nm.domainClass === cls.name)
        .map((nm) => nm.id);
      const targetMappingIds = nodeMappings
        .filter((nm) => nm.domainClass === ref.targetId)
        .map((nm) => nm.id);

      if (sourceMappingIds.length === 0 || targetMappingIds.length === 0) continue;

      const edgeStyle: EdgeStyleSpec = {
        ...createDefaultEdgeStyle(),
        color: EDGE_COLORS[edgeMappings.length % EDGE_COLORS.length],
        sourceDecoration: ref.containment ? 'filled-diamond' : 'none',
        targetDecoration: 'arrow',
      };

      edgeMappings.push({
        id: `em_${uid()}`,
        type: 'relation-based',
        sourceReference: ref.name,
        sourceMappingIds,
        targetMappingIds,
        targetFinderExpression: `self.${ref.name}`,
        defaultStyle: edgeStyle,
        conditionalStyles: [],
      });
    }
  }

  // Build creation tools
  const nodeTools: NodeCreationTool[] = concreteClasses.map((cls, i) => {
    const mapping = nodeMappings.find((nm) => nm.domainClass === cls.name);
    return {
      id: `nct_${uid()}`,
      type: 'nodeCreation' as const,
      label: `Create ${cls.name}`,
      iconColor: NODE_COLORS[i % NODE_COLORS.length].color,
      mappingId: mapping?.id || '',
      createType: cls.name,
      containmentReference: findContainmentRef(allClasses, cls.name),
      initialAttributes: { name: `"New ${cls.name}"` },
    };
  });

  const edgeTools: EdgeCreationTool[] = edgeMappings.map((em) => ({
    id: `ect_${uid()}`,
    type: 'edgeCreation' as const,
    label: `Create ${em.sourceReference || 'link'}`,
    edgeMappingId: em.id,
    referenceToSet: em.sourceReference,
  }));

  // Delete tool for all mappings
  const deleteTool: DeleteTool = {
    id: `dt_${uid()}`,
    type: 'delete',
    label: 'Delete',
    mappingIds: nodeMappings.map((nm) => nm.id),
  };

  // Direct edit tool for all mappings
  const directEditTool: DirectEditTool = {
    id: `det_${uid()}`,
    type: 'directEdit',
    label: 'Edit Name',
    mappingIds: nodeMappings.map((nm) => nm.id),
    inputLabelExpression: 'self.name',
    featureToSet: 'name',
  };

  // Organize tools into sections
  const toolSections: ToolSection[] = [
    {
      id: `ts_${uid()}`,
      label: 'Nodes',
      tools: nodeTools,
    },
    {
      id: `ts_${uid()}`,
      label: 'Edges',
      tools: edgeTools,
    },
    {
      id: `ts_${uid()}`,
      label: 'Edit',
      tools: [deleteTool, directEditTool],
    },
  ];

  // Build default layer
  const defaultLayer: Layer = {
    ...createDefaultLayer(),
    nodeMappings,
    containerMappings: [],
    edgeMappings,
    toolSections,
  };

  return {
    id: `vsp_${uid()}`,
    name: `${metamodel.name} Diagram`,
    metamodelId,
    diagram: {
      id: `diag_${uid()}`,
      label: `${metamodel.name} Diagram`,
      domainClass: metamodel.name,
    },
    defaultLayer,
    additionalLayers: [],
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

/**
 * Find the containment reference that holds instances of a given class.
 * Looks for any EReference with containment=true targeting this class.
 * Falls back to a generic 'elements' reference.
 */
function findContainmentRef(allClasses: MetamodelClass[], targetClassName: string): string {
  for (const cls of allClasses) {
    for (const ref of cls.eReferences || []) {
      if (ref.containment && ref.targetId === targetClassName) {
        return ref.name;
      }
    }
  }
  return 'elements'; // fallback
}
