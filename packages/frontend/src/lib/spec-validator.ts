/**
 * @emf-webapp/frontend — Spec Validator
 *
 * Validates that a ViewpointSpec is internally consistent and references
 * valid metamodel elements. Returns a list of validation errors/warnings.
 */
import type {
  ViewpointSpec,
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
  Tool,
  NodeCreationTool,
  ContainerCreationTool,
  EdgeCreationTool,
  DeleteTool,
  DirectEditTool,
} from '../components/spec-diagram/types';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  message: string;
  path?: string; // e.g. "defaultLayer.nodeMappings[0]"
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

interface MetamodelInfo {
  classNames: string[];
  referenceNames: Map<string, string[]>; // className → reference names
}

/**
 * Validate a ViewpointSpec against its metamodel.
 */
export function validateSpec(
  spec: ViewpointSpec,
  metamodel: MetamodelInfo,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Basic structure
  if (!spec.name || spec.name.trim() === '') {
    issues.push({ severity: 'error', message: 'Spec name is required', path: 'name' });
  }
  if (!spec.diagram.domainClass) {
    issues.push({ severity: 'warning', message: 'Diagram root domain class not set', path: 'diagram.domainClass' });
  } else if (!metamodel.classNames.includes(spec.diagram.domainClass)) {
    issues.push({
      severity: 'error',
      message: `Diagram domain class "${spec.diagram.domainClass}" not found in metamodel`,
      path: 'diagram.domainClass',
    });
  }

  // 2. Collect all mapping IDs for cross-reference validation
  const allMappingIds = new Set<string>();
  const allEdgeMappingIds = new Set<string>();

  const allLayers = [spec.defaultLayer, ...spec.additionalLayers];

  for (const layer of allLayers) {
    for (const nm of layer.nodeMappings) {
      allMappingIds.add(nm.id);
    }
    for (const cm of layer.containerMappings) {
      allMappingIds.add(cm.id);
    }
    for (const em of layer.edgeMappings) {
      allEdgeMappingIds.add(em.id);
    }
  }

  // 3. Validate each layer
  validateLayer(spec.defaultLayer, 'defaultLayer', metamodel, allMappingIds, allEdgeMappingIds, issues);
  for (let i = 0; i < spec.additionalLayers.length; i++) {
    validateLayer(
      spec.additionalLayers[i],
      `additionalLayers[${i}]`,
      metamodel,
      allMappingIds,
      allEdgeMappingIds,
      issues,
    );
  }

  // 4. Check that at least one node mapping exists
  const totalNodeMappings = allLayers.reduce(
    (sum, l) => sum + l.nodeMappings.length + l.containerMappings.length, 0,
  );
  if (totalNodeMappings === 0) {
    issues.push({ severity: 'warning', message: 'No node mappings defined — diagram will be empty' });
  }

  // 5. Check that creation tools exist for at least some mappings
  const allTools = allLayers.flatMap((l) => l.toolSections.flatMap((ts) => ts.tools));
  const creationTools = allTools.filter((t) => t.type === 'nodeCreation' || t.type === 'containerCreation');
  if (creationTools.length === 0 && totalNodeMappings > 0) {
    issues.push({
      severity: 'warning',
      message: 'No creation tools defined — users won\'t be able to create elements',
    });
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

function validateLayer(
  layer: Layer,
  path: string,
  metamodel: MetamodelInfo,
  allMappingIds: Set<string>,
  allEdgeMappingIds: Set<string>,
  issues: ValidationIssue[],
): void {
  if (!layer.name || layer.name.trim() === '') {
    issues.push({ severity: 'error', message: 'Layer name is required', path: `${path}.name` });
  }

  // Validate node mappings
  for (let i = 0; i < layer.nodeMappings.length; i++) {
    validateNodeMapping(layer.nodeMappings[i], `${path}.nodeMappings[${i}]`, metamodel, issues);
  }

  // Validate container mappings
  for (let i = 0; i < layer.containerMappings.length; i++) {
    validateContainerMapping(
      layer.containerMappings[i],
      `${path}.containerMappings[${i}]`,
      metamodel,
      allMappingIds,
      issues,
    );
  }

  // Validate edge mappings
  for (let i = 0; i < layer.edgeMappings.length; i++) {
    validateEdgeMapping(
      layer.edgeMappings[i],
      `${path}.edgeMappings[${i}]`,
      metamodel,
      allMappingIds,
      issues,
    );
  }

  // Validate tools
  for (let si = 0; si < layer.toolSections.length; si++) {
    const section = layer.toolSections[si];
    for (let ti = 0; ti < section.tools.length; ti++) {
      validateTool(
        section.tools[ti],
        `${path}.toolSections[${si}].tools[${ti}]`,
        metamodel,
        allMappingIds,
        allEdgeMappingIds,
        issues,
      );
    }
  }
}

function validateNodeMapping(
  mapping: NodeMapping,
  path: string,
  metamodel: MetamodelInfo,
  issues: ValidationIssue[],
): void {
  if (!mapping.domainClass) {
    issues.push({ severity: 'error', message: 'Node mapping domain class is required', path });
  } else if (!metamodel.classNames.includes(mapping.domainClass)) {
    issues.push({
      severity: 'error',
      message: `Domain class "${mapping.domainClass}" not found in metamodel`,
      path,
    });
  }

  if (!mapping.labelExpression) {
    issues.push({ severity: 'warning', message: 'No label expression — nodes will have no label', path });
  }

  if (!mapping.defaultStyle) {
    issues.push({ severity: 'error', message: 'Default style is required', path });
  }
}

function validateContainerMapping(
  mapping: ContainerMapping,
  path: string,
  metamodel: MetamodelInfo,
  allMappingIds: Set<string>,
  issues: ValidationIssue[],
): void {
  validateNodeMapping(mapping, path, metamodel, issues);

  // Validate sub-mapping references
  for (const subId of mapping.subNodeMappingIds || []) {
    if (!allMappingIds.has(subId)) {
      issues.push({
        severity: 'error',
        message: `Sub-node mapping ID "${subId}" not found`,
        path: `${path}.subNodeMappingIds`,
      });
    }
  }
  for (const subId of mapping.subContainerMappingIds || []) {
    if (!allMappingIds.has(subId)) {
      issues.push({
        severity: 'error',
        message: `Sub-container mapping ID "${subId}" not found`,
        path: `${path}.subContainerMappingIds`,
      });
    }
  }
}

function validateEdgeMapping(
  mapping: EdgeMapping,
  path: string,
  metamodel: MetamodelInfo,
  allMappingIds: Set<string>,
  issues: ValidationIssue[],
): void {
  if (mapping.type === 'element-based') {
    if (!mapping.domainClass) {
      issues.push({ severity: 'error', message: 'Element-based edge requires domainClass', path });
    } else if (!metamodel.classNames.includes(mapping.domainClass)) {
      issues.push({
        severity: 'error',
        message: `Edge domain class "${mapping.domainClass}" not found in metamodel`,
        path,
      });
    }
  }

  if (mapping.type === 'relation-based' && !mapping.sourceReference) {
    issues.push({ severity: 'warning', message: 'Relation-based edge has no sourceReference', path });
  }

  if (!mapping.targetFinderExpression) {
    issues.push({ severity: 'error', message: 'Edge mapping requires targetFinderExpression', path });
  }

  // Validate source/target mapping references
  for (const id of mapping.sourceMappingIds) {
    if (!allMappingIds.has(id)) {
      issues.push({
        severity: 'error',
        message: `Source mapping ID "${id}" not found`,
        path: `${path}.sourceMappingIds`,
      });
    }
  }
  for (const id of mapping.targetMappingIds) {
    if (!allMappingIds.has(id)) {
      issues.push({
        severity: 'error',
        message: `Target mapping ID "${id}" not found`,
        path: `${path}.targetMappingIds`,
      });
    }
  }
}

function validateTool(
  tool: Tool,
  path: string,
  metamodel: MetamodelInfo,
  allMappingIds: Set<string>,
  allEdgeMappingIds: Set<string>,
  issues: ValidationIssue[],
): void {
  if (!tool.label || tool.label.trim() === '') {
    issues.push({ severity: 'warning', message: 'Tool has no label', path });
  }

  switch (tool.type) {
    case 'nodeCreation':
    case 'containerCreation': {
      const ct = tool as NodeCreationTool | ContainerCreationTool;
      if (!allMappingIds.has(ct.mappingId)) {
        issues.push({
          severity: 'error',
          message: `Creation tool references non-existent mapping "${ct.mappingId}"`,
          path,
        });
      }
      if (!ct.createType) {
        issues.push({ severity: 'error', message: 'Creation tool requires createType', path });
      } else if (!metamodel.classNames.includes(ct.createType)) {
        issues.push({
          severity: 'error',
          message: `Creation tool createType "${ct.createType}" not found in metamodel`,
          path,
        });
      }
      if (!ct.containmentReference) {
        issues.push({ severity: 'warning', message: 'Creation tool has no containmentReference', path });
      }
      break;
    }
    case 'edgeCreation': {
      const et = tool as EdgeCreationTool;
      if (!allEdgeMappingIds.has(et.edgeMappingId)) {
        issues.push({
          severity: 'error',
          message: `Edge creation tool references non-existent edge mapping "${et.edgeMappingId}"`,
          path,
        });
      }
      break;
    }
    case 'delete': {
      const dt = tool as DeleteTool;
      for (const id of dt.mappingIds) {
        if (!allMappingIds.has(id)) {
          issues.push({
            severity: 'warning',
            message: `Delete tool references non-existent mapping "${id}"`,
            path,
          });
        }
      }
      break;
    }
    case 'directEdit': {
      const det = tool as DirectEditTool;
      if (!det.featureToSet) {
        issues.push({ severity: 'error', message: 'Direct edit tool requires featureToSet', path });
      }
      for (const id of det.mappingIds) {
        if (!allMappingIds.has(id)) {
          issues.push({
            severity: 'warning',
            message: `Direct edit tool references non-existent mapping "${id}"`,
            path,
          });
        }
      }
      break;
    }
  }
}

/**
 * Extract metamodel info from a SerializableEPackage for validation.
 */
export function extractMetamodelInfo(content: Record<string, unknown>): MetamodelInfo {
  const classifiers = (content.eClassifiers || []) as Array<Record<string, unknown>>;
  const classNames: string[] = [];
  const referenceNames = new Map<string, string[]>();

  for (const cls of classifiers) {
    const name = cls.name as string;
    if (name) {
      classNames.push(name);
      const refs = (cls.eReferences || []) as Array<Record<string, unknown>>;
      referenceNames.set(name, refs.map((r) => r.name as string).filter(Boolean));
    }
  }

  return { classNames, referenceNames };
}
