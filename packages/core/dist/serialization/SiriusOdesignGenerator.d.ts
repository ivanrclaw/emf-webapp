/**
 * @emf-webapp/core — SiriusOdesignGenerator
 *
 * Generates Eclipse Sirius .odesign (Viewpoint Specification Model) XML
 * from the webapp's ViewpointSpec JSON format.
 *
 * The .odesign file defines the graphical syntax for a domain model:
 *   - DiagramDescription: root diagram configuration
 *   - NodeMappings: how EClasses are rendered as nodes
 *   - ContainerMappings: how EClasses with children are rendered
 *   - EdgeMappings: how EReferences/EClasses are rendered as edges
 *   - Tools: creation, deletion, direct edit tools
 *   - Styles: visual appearance (colors, shapes, labels)
 *
 * Namespace: http://www.eclipse.org/sirius/description/1.1.0
 * Diagram NS: http://www.eclipse.org/sirius/diagram/description/1.1.0
 */
export interface OdesignViewpointSpec {
    id: string;
    name: string;
    metamodelNsURI: string;
    diagram: OdesignDiagramDescription;
    defaultLayer: OdesignLayer;
    additionalLayers: OdesignLayer[];
}
export interface OdesignDiagramDescription {
    id: string;
    label: string;
    domainClass: string;
    titleExpression?: string;
}
export interface OdesignLayer {
    id: string;
    name: string;
    isDefault: boolean;
    activeByDefault: boolean;
    nodeMappings: OdesignNodeMapping[];
    containerMappings: OdesignContainerMapping[];
    edgeMappings: OdesignEdgeMapping[];
    toolSections: OdesignToolSection[];
}
export interface OdesignNodeStyle {
    shape: string;
    color: string;
    borderColor: string;
    borderSize: number;
    borderLineStyle: string;
    width?: number;
    height?: number;
    labelExpression: string;
    labelColor: string;
    labelSize: number;
    labelPosition: string;
    labelBold: boolean;
    labelItalic: boolean;
}
export interface OdesignEdgeStyle {
    lineStyle: string;
    lineWidth: number;
    color: string;
    sourceDecoration: string;
    targetDecoration: string;
    routingStyle: string;
    centerLabelExpression?: string;
    beginLabelExpression?: string;
    endLabelExpression?: string;
    labelColor: string;
    labelSize: number;
}
export interface OdesignNodeMapping {
    id: string;
    domainClass: string;
    semanticCandidatesExpression: string;
    preconditionExpression?: string;
    labelExpression: string;
    defaultStyle: OdesignNodeStyle;
}
export interface OdesignContainerMapping extends OdesignNodeMapping {
    childrenPresentation: string;
    subNodeMappingIds: string[];
    subContainerMappingIds: string[];
}
export interface OdesignEdgeMapping {
    id: string;
    type: 'relation-based' | 'element-based';
    sourceReference?: string;
    domainClass?: string;
    semanticCandidatesExpression?: string;
    sourceMappingIds: string[];
    targetMappingIds: string[];
    sourceFinderExpression?: string;
    targetFinderExpression: string;
    preconditionExpression?: string;
    defaultStyle: OdesignEdgeStyle;
}
export interface OdesignToolSection {
    id: string;
    label: string;
    tools: OdesignTool[];
}
export interface OdesignTool {
    id: string;
    type: string;
    label: string;
    mappingId?: string;
    edgeMappingId?: string;
    createType?: string;
    containmentReference?: string;
    featureToSet?: string;
    mappingIds?: string[];
}
export interface OdesignOptions {
    /** Plugin ID for the .odesign project */
    pluginId: string;
    /** Metamodel package name */
    packageName: string;
    /** Metamodel nsURI */
    nsURI: string;
}
/**
 * Generates a Sirius .odesign XML file from a ViewpointSpec.
 */
export declare function generateOdesign(spec: OdesignViewpointSpec, options: OdesignOptions): string;
//# sourceMappingURL=SiriusOdesignGenerator.d.ts.map