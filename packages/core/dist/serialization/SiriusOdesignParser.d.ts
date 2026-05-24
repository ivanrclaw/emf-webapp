/**
 * @emf-webapp/core — SiriusOdesignParser
 *
 * Parses Sirius .odesign XML files into a ViewpointSpec-compatible JSON structure.
 * Uses a lightweight built-in XML parser (no external dependencies).
 */
export interface OdesignParseResult {
    pluginId: string;
    viewpoints: ParsedViewpoint[];
}
export interface ParsedViewpoint {
    name: string;
    diagram: {
        label: string;
        domainClass: string;
        titleExpression?: string;
    };
    defaultLayer: ParsedLayer;
    additionalLayers: ParsedLayer[];
}
export interface ParsedLayer {
    name: string;
    nodeMappings: ParsedNodeMapping[];
    containerMappings: ParsedContainerMapping[];
    edgeMappings: ParsedEdgeMapping[];
    toolSections: ParsedToolSection[];
}
export interface NodeStyle {
    shape: string;
    color: string;
    borderColor: string;
    borderSize: number;
    borderLineStyle: string;
    labelColor: string;
    labelSize: number;
    labelBold: boolean;
    labelItalic: boolean;
    labelPosition: string;
}
export interface ParsedNodeMapping {
    id: string;
    domainClass: string;
    semanticCandidatesExpression: string;
    labelExpression: string;
    defaultStyle: NodeStyle;
}
export interface ParsedContainerMapping extends ParsedNodeMapping {
    childrenPresentation: string;
}
export interface EdgeStyle {
    lineStyle: string;
    lineWidth: number;
    color: string;
    sourceDecoration: string;
    targetDecoration: string;
    routingStyle: string;
    centerLabelExpression?: string;
    labelColor: string;
    labelSize: number;
}
export interface ParsedEdgeMapping {
    id: string;
    type: 'relation-based' | 'element-based';
    domainClass?: string;
    sourceReference?: string;
    sourceMappingIds: string[];
    targetMappingIds: string[];
    targetFinderExpression: string;
    sourceFinderExpression?: string;
    defaultStyle: EdgeStyle;
}
export interface ParsedToolSection {
    label: string;
    tools: ParsedTool[];
}
export interface ParsedTool {
    type: string;
    label: string;
    createType?: string;
    containmentReference?: string;
    featureToSet?: string;
}
/**
 * Parses a Sirius .odesign XML string into a ViewpointSpec-compatible JSON structure.
 *
 * @param xml - The .odesign XML content as a string
 * @returns Parsed result with pluginId and viewpoints
 */
export declare function parseOdesign(xml: string): OdesignParseResult;
//# sourceMappingURL=SiriusOdesignParser.d.ts.map