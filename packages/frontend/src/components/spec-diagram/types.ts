/**
 * @emf-webapp/frontend — Viewpoint Specification Types (Sirius-compatible)
 *
 * Full type system for defining graphical syntax specifications.
 * Follows Eclipse Sirius architecture:
 *   Metamodel (Ecore) → ViewpointSpec (VSM) → Runtime Editor (constrained)
 */

// ─── Expression Engine Types ───────────────────────────────────────────────────
/** Safe expression string evaluated at runtime against a semantic element (self) */
export type Expression = string;

// ─── Style Enums ───────────────────────────────────────────────────────────────
export type ShapeType = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'diamond' | 'note' | 'image';
export type LineStyleType = 'solid' | 'dash' | 'dot' | 'dash-dot';
export type DecorationArrow =
  | 'none'
  | 'arrow'
  | 'open-arrow'
  | 'diamond'
  | 'filled-diamond'
  | 'triangle'
  | 'filled-triangle';
export type LabelPosition = 'inside' | 'top' | 'bottom' | 'border';
export type ChildrenPresentation = 'FreeForm' | 'List' | 'HorizontalStack' | 'VerticalStack';
export type RoutingStyle = 'straight' | 'manhattan' | 'tree';

// ─── Node Style ────────────────────────────────────────────────────────────────
export interface NodeStyle {
  shape: ShapeType;
  color: string;
  borderColor: string;
  borderSize: number;
  borderLineStyle: LineStyleType;
  width?: number;
  height?: number;
  labelExpression: Expression;
  labelColor: string;
  labelSize: number;
  labelPosition: LabelPosition;
  labelBold: boolean;
  labelItalic: boolean;
  showIcon: boolean;
  iconPath?: string;
  tooltipExpression?: Expression;
}

export interface ConditionalStyle<T> {
  id: string;
  predicateExpression: Expression;
  style: Partial<T>;
}

// ─── Edge Style ────────────────────────────────────────────────────────────────
export interface EdgeStyleSpec {
  lineStyle: LineStyleType;
  lineWidth: number;
  color: string;
  sourceDecoration: DecorationArrow;
  targetDecoration: DecorationArrow;
  routingStyle: RoutingStyle;
  centerLabelExpression?: Expression;
  beginLabelExpression?: Expression;
  endLabelExpression?: Expression;
  labelColor: string;
  labelSize: number;
}

// ─── Mappings ──────────────────────────────────────────────────────────────────
export interface NodeMapping {
  id: string;
  domainClass: string;
  semanticCandidatesExpression: Expression;
  preconditionExpression?: Expression;
  labelExpression: Expression;
  defaultStyle: NodeStyle;
  conditionalStyles: ConditionalStyle<NodeStyle>[];
}

export interface ContainerMapping extends NodeMapping {
  childrenPresentation: ChildrenPresentation;
  subNodeMappingIds: string[];
  subContainerMappingIds: string[];
}

export interface EdgeMapping {
  id: string;
  type: 'relation-based' | 'element-based';
  /** For relation-based: the EReference name on the source class */
  sourceReference?: string;
  /** For element-based: the EClass name of the edge element */
  domainClass?: string;
  /** For element-based: expression to find all edge instances */
  semanticCandidatesExpression?: Expression;
  /** IDs of NodeMappings/ContainerMappings that can be source */
  sourceMappingIds: string[];
  /** IDs of NodeMappings/ContainerMappings that can be target */
  targetMappingIds: string[];
  /** For element-based: from edge element, find source */
  sourceFinderExpression?: Expression;
  /** From source (relation-based) or edge element, find target(s) */
  targetFinderExpression: Expression;
  preconditionExpression?: Expression;
  defaultStyle: EdgeStyleSpec;
  conditionalStyles: ConditionalStyle<EdgeStyleSpec>[];
}

// ─── Tools ─────────────────────────────────────────────────────────────────────
export interface NodeCreationTool {
  id: string;
  type: 'nodeCreation';
  label: string;
  iconColor?: string;
  /** Which NodeMapping this tool creates elements for */
  mappingId: string;
  preconditionExpression?: Expression;
  /** EClass name to instantiate */
  createType: string;
  /** Containment reference on the parent to add the new element to */
  containmentReference: string;
  /** Initial attribute values (expression evaluated in context of new element) */
  initialAttributes?: Record<string, Expression>;
}

export interface ContainerCreationTool {
  id: string;
  type: 'containerCreation';
  label: string;
  iconColor?: string;
  mappingId: string;
  preconditionExpression?: Expression;
  createType: string;
  containmentReference: string;
  initialAttributes?: Record<string, Expression>;
}

export interface EdgeCreationTool {
  id: string;
  type: 'edgeCreation';
  label: string;
  iconColor?: string;
  edgeMappingId: string;
  preconditionExpression?: Expression;
  /** For relation-based: which reference on source to set */
  referenceToSet?: string;
  /** For element-based: EClass to create */
  createType?: string;
  /** For element-based: containment reference for the new edge element */
  containmentReference?: string;
}

export interface DeleteTool {
  id: string;
  type: 'delete';
  label: string;
  /** Which mappings this delete tool applies to */
  mappingIds: string[];
}

export interface DirectEditTool {
  id: string;
  type: 'directEdit';
  label: string;
  /** Which mappings support direct edit */
  mappingIds: string[];
  /** Expression for initial value in edit field */
  inputLabelExpression?: Expression;
  /** Which attribute to update with the edited value */
  featureToSet: string;
}

export type Tool =
  | NodeCreationTool
  | ContainerCreationTool
  | EdgeCreationTool
  | DeleteTool
  | DirectEditTool;

export interface ToolSection {
  id: string;
  label: string;
  tools: Tool[];
}

// ─── Layer ─────────────────────────────────────────────────────────────────────
export interface Layer {
  id: string;
  name: string;
  isDefault: boolean;
  activeByDefault: boolean;
  nodeMappings: NodeMapping[];
  containerMappings: ContainerMapping[];
  edgeMappings: EdgeMapping[];
  toolSections: ToolSection[];
}

// ─── Diagram Description ───────────────────────────────────────────────────────
export interface DiagramDescription {
  id: string;
  label: string;
  /** Root EClass for the diagram (e.g. the EPackage or root container) */
  domainClass: string;
  titleExpression?: Expression;
}

// ─── Top-Level Viewpoint Specification ─────────────────────────────────────────
export interface ViewpointSpec {
  id: string;
  name: string;
  metamodelId: string;
  diagram: DiagramDescription;
  defaultLayer: Layer;
  additionalLayers: Layer[];
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

export function createDefaultNodeStyle(): NodeStyle {
  return {
    shape: 'rectangle',
    color: '#6366f1',
    borderColor: '#818cf8',
    borderSize: 2,
    borderLineStyle: 'solid',
    labelExpression: 'self.name',
    labelColor: '#ffffff',
    labelSize: 13,
    labelPosition: 'inside',
    labelBold: false,
    labelItalic: false,
    showIcon: false,
  };
}

export function createDefaultEdgeStyle(): EdgeStyleSpec {
  return {
    lineStyle: 'solid',
    lineWidth: 2,
    color: '#6366f1',
    sourceDecoration: 'none',
    targetDecoration: 'arrow',
    routingStyle: 'manhattan',
    labelColor: '#a1a1aa',
    labelSize: 11,
  };
}

export function createDefaultLayer(id?: string): Layer {
  return {
    id: id || 'layer_default',
    name: 'Default',
    isDefault: true,
    activeByDefault: true,
    nodeMappings: [],
    containerMappings: [],
    edgeMappings: [],
    toolSections: [],
  };
}

export function createDefaultViewpointSpec(metamodelId: string): ViewpointSpec {
  return {
    id: `vsp_${Math.random().toString(36).slice(2, 10)}`,
    name: 'New Viewpoint',
    metamodelId,
    diagram: {
      id: `diag_${Math.random().toString(36).slice(2, 10)}`,
      label: 'Main Diagram',
      domainClass: '',
    },
    defaultLayer: createDefaultLayer(),
    additionalLayers: [],
  };
}

// ─── Legacy Compatibility (for SpecNode/SpecEdge during transition) ─────────
/** @deprecated Use NodeStyle */
export type ShapeStyle = NodeStyle;
/** @deprecated Use EdgeStyleSpec */
export type EdgeStyle = EdgeStyleSpec;
/** @deprecated Use ViewpointSpec */
export type SpecData = ViewpointSpec;
