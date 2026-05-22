/**
 * Spec Validator — Validates ViewpointSpec for completeness and correctness.
 * Returns a list of warnings/errors for display in the UI.
 */
import type {
  ViewpointSpec,
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
} from '../../spec-diagram/types';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  mappingId?: string;
  mappingType?: 'node' | 'container' | 'edge' | 'layer';
  message: string;
}

export function validateSpec(spec: ViewpointSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validate all layers
  const allLayers = [spec.defaultLayer, ...spec.additionalLayers];
  for (const layer of allLayers) {
    issues.push(...validateLayer(layer, allLayers));
  }

  // Diagram description
  if (!spec.diagram.domainClass) {
    issues.push({ severity: 'warning', message: 'Diagram has no root domain class set' });
  }

  return issues;
}

function validateLayer(layer: Layer, allLayers: Layer[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validate node mappings
  for (const nm of layer.nodeMappings) {
    issues.push(...validateNodeMapping(nm));
  }

  // Validate container mappings
  for (const cm of layer.containerMappings) {
    issues.push(...validateContainerMapping(cm, layer));
  }

  // Validate edge mappings
  for (const em of layer.edgeMappings) {
    issues.push(...validateEdgeMapping(em, layer));
  }

  return issues;
}

function validateNodeMapping(nm: NodeMapping): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ctx = { mappingId: nm.id, mappingType: 'node' as const };

  if (!nm.domainClass) {
    issues.push({ ...ctx, severity: 'error', message: `Node mapping has no domain class` });
  }
  if (!nm.labelExpression) {
    issues.push({ ...ctx, severity: 'warning', message: `${nm.domainClass}: empty label expression` });
  }
  if (!nm.semanticCandidatesExpression) {
    issues.push({ ...ctx, severity: 'warning', message: `${nm.domainClass}: empty semantic candidates expression` });
  }
  if (!nm.defaultStyle.color) {
    issues.push({ ...ctx, severity: 'warning', message: `${nm.domainClass}: no fill color set` });
  }

  return issues;
}

function validateContainerMapping(cm: ContainerMapping, layer: Layer): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ctx = { mappingId: cm.id, mappingType: 'container' as const };

  // Base node validation
  issues.push(...validateNodeMapping(cm).map((i) => ({ ...i, mappingType: 'container' as const })));

  // Container-specific
  if (cm.subNodeMappingIds.length === 0 && cm.subContainerMappingIds.length === 0) {
    issues.push({ ...ctx, severity: 'warning', message: `${cm.domainClass}: container has no child mappings` });
  }

  // Check that referenced sub-mappings exist
  for (const subId of cm.subNodeMappingIds) {
    if (!layer.nodeMappings.some((m) => m.id === subId)) {
      issues.push({ ...ctx, severity: 'error', message: `${cm.domainClass}: references non-existent sub-node mapping` });
    }
  }

  return issues;
}

function validateEdgeMapping(em: EdgeMapping, layer: Layer): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ctx = { mappingId: em.id, mappingType: 'edge' as const };
  const label = em.sourceReference || em.domainClass || em.id;

  if (em.type === 'relation-based' && !em.sourceReference) {
    issues.push({ ...ctx, severity: 'error', message: `Edge "${label}": no source reference set` });
  }
  if (em.type === 'element-based' && !em.domainClass) {
    issues.push({ ...ctx, severity: 'error', message: `Edge "${label}": no domain class set` });
  }
  if (!em.targetFinderExpression) {
    issues.push({ ...ctx, severity: 'warning', message: `Edge "${label}": empty target finder expression` });
  }
  if (em.sourceMappingIds.length === 0) {
    issues.push({ ...ctx, severity: 'warning', message: `Edge "${label}": no source mappings connected` });
  }
  if (em.targetMappingIds.length === 0) {
    issues.push({ ...ctx, severity: 'warning', message: `Edge "${label}": no target mappings connected` });
  }

  // Check that referenced mappings exist
  const allMappingIds = new Set([
    ...layer.nodeMappings.map((m) => m.id),
    ...layer.containerMappings.map((m) => m.id),
  ]);
  for (const id of em.sourceMappingIds) {
    if (!allMappingIds.has(id)) {
      issues.push({ ...ctx, severity: 'error', message: `Edge "${label}": source mapping "${id}" not found` });
    }
  }
  for (const id of em.targetMappingIds) {
    if (!allMappingIds.has(id)) {
      issues.push({ ...ctx, severity: 'error', message: `Edge "${label}": target mapping "${id}" not found` });
    }
  }

  return issues;
}
