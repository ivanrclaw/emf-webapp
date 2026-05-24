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
// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════
const SIRIUS_DESC_NS = 'http://www.eclipse.org/sirius/description/1.1.0';
const SIRIUS_DIAG_NS = 'http://www.eclipse.org/sirius/diagram/description/1.1.0';
const SIRIUS_TOOL_NS = 'http://www.eclipse.org/sirius/diagram/description/tool/1.1.0';
const SIRIUS_STYLE_NS = 'http://www.eclipse.org/sirius/diagram/description/style/1.1.0';
const XMI_NS = 'http://www.omg.org/XMI';
/** Maps webapp shape types to Sirius shape names */
const SHAPE_MAP = {
    'rectangle': 'square',
    'rounded-rectangle': 'dot',
    'ellipse': 'ellipse',
    'diamond': 'diamond',
    'note': 'note',
    'image': 'workspace',
};
/** Maps webapp line styles to Sirius line styles */
const LINE_STYLE_MAP = {
    'solid': 'solid',
    'dash': 'dash',
    'dot': 'dot',
    'dash-dot': 'dash_dot',
};
/** Maps webapp arrow decorations to Sirius decorations */
const DECORATION_MAP = {
    'none': 'NoDecoration',
    'arrow': 'InputArrow',
    'open-arrow': 'InputArrow',
    'diamond': 'Diamond',
    'filled-diamond': 'InputFillClosedArrow',
    'triangle': 'InputClosedArrow',
    'filled-triangle': 'InputFillClosedArrow',
};
/** Maps webapp routing styles to Sirius routing */
const ROUTING_MAP = {
    'straight': 'straight',
    'manhattan': 'manhattan',
    'tree': 'tree',
};
/** Maps webapp children presentation to Sirius */
const CHILDREN_PRESENTATION_MAP = {
    'FreeForm': 'FreeForm',
    'List': 'List',
    'HorizontalStack': 'HorizontalStack',
    'VerticalStack': 'VerticalStack',
};
// ═══════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════
/**
 * Generates a Sirius .odesign XML file from a ViewpointSpec.
 */
export function generateOdesign(spec, options) {
    const lines = [];
    // XML header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    // Root element: description:Group
    lines.push(`<description:Group xmi:version="2.0"`);
    lines.push(`    xmlns:xmi="${XMI_NS}"`);
    lines.push(`    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
    lines.push(`    xmlns:description="${SIRIUS_DESC_NS}"`);
    lines.push(`    xmlns:description_1="${SIRIUS_DIAG_NS}"`);
    lines.push(`    xmlns:style="${SIRIUS_STYLE_NS}"`);
    lines.push(`    xmlns:tool="${SIRIUS_TOOL_NS}"`);
    lines.push(`    name="${escapeXml(options.pluginId)}">`);
    // Viewpoint
    lines.push(`  <ownedViewpoints name="${escapeXml(spec.name)}"`);
    lines.push(`      modelFileExtension="${escapeXml(options.packageName)}">`);
    // Metamodel reference
    lines.push(`    <ownedRepresentations xsi:type="description_1:DiagramDescription"`);
    lines.push(`        name="${escapeXml(spec.diagram.label)}"`);
    lines.push(`        domainClass="${escapeXml(qualifyDomainClass(spec.diagram.domainClass, options.nsURI))}"`);
    if (spec.diagram.titleExpression) {
        lines.push(`        titleExpression="${escapeXml(toAQL(spec.diagram.titleExpression))}">`);
    }
    else {
        lines.push(`        titleExpression="aql:self.name">`);
    }
    // Metamodel reference
    lines.push(`      <metamodel href="${escapeXml(options.nsURI)}#/"/>`);
    // Default layer
    emitLayer(lines, spec.defaultLayer, options, 6);
    // Additional layers
    for (const layer of spec.additionalLayers) {
        emitLayer(lines, layer, options, 6);
    }
    // Close DiagramDescription
    lines.push('    </ownedRepresentations>');
    // Owned Java Extensions (for service classes)
    lines.push(`    <ownedJavaExtensions qualifiedClassName="${options.pluginId}.design.Services"/>`);
    // Close Viewpoint
    lines.push('  </ownedViewpoints>');
    // Close Group
    lines.push('</description:Group>');
    lines.push('');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// Layer emission
// ═══════════════════════════════════════════════════════════════
function emitLayer(lines, layer, options, baseIndent) {
    const ind = ' '.repeat(baseIndent);
    if (layer.isDefault) {
        lines.push(`${ind}<defaultLayer name="${escapeXml(layer.name)}">`);
    }
    else {
        lines.push(`${ind}<additionalLayers name="${escapeXml(layer.name)}" activeByDefault="${layer.activeByDefault}">`);
    }
    // Node mappings
    for (const nm of layer.nodeMappings) {
        emitNodeMapping(lines, nm, options, baseIndent + 2);
    }
    // Container mappings
    for (const cm of layer.containerMappings) {
        emitContainerMapping(lines, cm, options, baseIndent + 2);
    }
    // Edge mappings
    for (const em of layer.edgeMappings) {
        emitEdgeMapping(lines, em, options, baseIndent + 2);
    }
    // Tool sections
    for (const ts of layer.toolSections) {
        emitToolSection(lines, ts, options, baseIndent + 2);
    }
    if (layer.isDefault) {
        lines.push(`${ind}</defaultLayer>`);
    }
    else {
        lines.push(`${ind}</additionalLayers>`);
    }
}
// ═══════════════════════════════════════════════════════════════
// Node Mapping
// ═══════════════════════════════════════════════════════════════
function emitNodeMapping(lines, nm, options, depth) {
    const ind = ' '.repeat(depth);
    const domainClass = qualifyDomainClass(nm.domainClass, options.nsURI);
    const semanticExpr = toAQL(nm.semanticCandidatesExpression);
    lines.push(`${ind}<nodeMappings name="${escapeXml(nm.id)}"`);
    lines.push(`${ind}    domainClass="${escapeXml(domainClass)}"`);
    lines.push(`${ind}    semanticCandidatesExpression="${escapeXml(semanticExpr)}">`);
    // Style
    emitNodeStyle(lines, nm.defaultStyle, depth + 2);
    lines.push(`${ind}</nodeMappings>`);
}
// ═══════════════════════════════════════════════════════════════
// Container Mapping
// ═══════════════════════════════════════════════════════════════
function emitContainerMapping(lines, cm, options, depth) {
    const ind = ' '.repeat(depth);
    const domainClass = qualifyDomainClass(cm.domainClass, options.nsURI);
    const semanticExpr = toAQL(cm.semanticCandidatesExpression);
    const childrenPres = CHILDREN_PRESENTATION_MAP[cm.childrenPresentation] || 'FreeForm';
    lines.push(`${ind}<containerMappings name="${escapeXml(cm.id)}"`);
    lines.push(`${ind}    domainClass="${escapeXml(domainClass)}"`);
    lines.push(`${ind}    semanticCandidatesExpression="${escapeXml(semanticExpr)}"`);
    lines.push(`${ind}    childrenPresentation="${childrenPres}">`);
    // Style (FlatContainerStyleDescription for containers)
    emitContainerStyle(lines, cm.defaultStyle, depth + 2);
    lines.push(`${ind}</containerMappings>`);
}
// ═══════════════════════════════════════════════════════════════
// Edge Mapping
// ═══════════════════════════════════════════════════════════════
function emitEdgeMapping(lines, em, options, depth) {
    const ind = ' '.repeat(depth);
    const attrs = [];
    attrs.push(`name="${escapeXml(em.id)}"`);
    if (em.type === 'element-based') {
        attrs.push(`useDomainElement="true"`);
        if (em.domainClass) {
            attrs.push(`domainClass="${escapeXml(qualifyDomainClass(em.domainClass, options.nsURI))}"`);
        }
        if (em.semanticCandidatesExpression) {
            attrs.push(`semanticCandidatesExpression="${escapeXml(toAQL(em.semanticCandidatesExpression))}"`);
        }
        if (em.sourceFinderExpression) {
            attrs.push(`sourceFinderExpression="${escapeXml(toAQL(em.sourceFinderExpression))}"`);
        }
    }
    attrs.push(`targetFinderExpression="${escapeXml(toAQL(em.targetFinderExpression))}"`);
    lines.push(`${ind}<edgeMappings ${attrs.join(`\n${ind}    `)}>`);
    // Source/target mapping references
    for (const srcId of em.sourceMappingIds) {
        lines.push(`${ind}  <sourceMapping xsi:type="description_1:NodeMapping" href="#//${srcId}"/>`);
    }
    for (const tgtId of em.targetMappingIds) {
        lines.push(`${ind}  <targetMapping xsi:type="description_1:NodeMapping" href="#//${tgtId}"/>`);
    }
    // Edge style
    emitEdgeStyle(lines, em.defaultStyle, depth + 2);
    lines.push(`${ind}</edgeMappings>`);
}
// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════
function emitNodeStyle(lines, style, depth) {
    const ind = ' '.repeat(depth);
    const shape = SHAPE_MAP[style.shape] || 'square';
    lines.push(`${ind}<style xsi:type="style:${getStyleType(shape)}"`);
    lines.push(`${ind}    labelSize="${style.labelSize}"`);
    lines.push(`${ind}    labelExpression="${escapeXml(toAQL(style.labelExpression))}"`);
    if (style.labelBold) {
        lines.push(`${ind}    labelFormat="bold"`);
    }
    else if (style.labelItalic) {
        lines.push(`${ind}    labelFormat="italic"`);
    }
    lines.push(`${ind}    borderSizeComputationExpression="${style.borderSize}"`);
    lines.push(`${ind}    borderLineStyle="${LINE_STYLE_MAP[style.borderLineStyle] || 'solid'}">`);
    // Colors
    lines.push(`${ind}  <borderColor xsi:type="description:UserFixedColor" red="${hexR(style.borderColor)}" green="${hexG(style.borderColor)}" blue="${hexB(style.borderColor)}"/>`);
    lines.push(`${ind}  <labelColor xsi:type="description:UserFixedColor" red="${hexR(style.labelColor)}" green="${hexG(style.labelColor)}" blue="${hexB(style.labelColor)}"/>`);
    lines.push(`${ind}  <color xsi:type="description:UserFixedColor" red="${hexR(style.color)}" green="${hexG(style.color)}" blue="${hexB(style.color)}"/>`);
    lines.push(`${ind}</style>`);
}
function emitContainerStyle(lines, style, depth) {
    const ind = ' '.repeat(depth);
    lines.push(`${ind}<style xsi:type="style:FlatContainerStyleDescription"`);
    lines.push(`${ind}    labelSize="${style.labelSize}"`);
    lines.push(`${ind}    labelExpression="${escapeXml(toAQL(style.labelExpression))}"`);
    lines.push(`${ind}    borderSizeComputationExpression="${style.borderSize}"`);
    lines.push(`${ind}    borderLineStyle="${LINE_STYLE_MAP[style.borderLineStyle] || 'solid'}">`);
    lines.push(`${ind}  <borderColor xsi:type="description:UserFixedColor" red="${hexR(style.borderColor)}" green="${hexG(style.borderColor)}" blue="${hexB(style.borderColor)}"/>`);
    lines.push(`${ind}  <labelColor xsi:type="description:UserFixedColor" red="${hexR(style.labelColor)}" green="${hexG(style.labelColor)}" blue="${hexB(style.labelColor)}"/>`);
    lines.push(`${ind}  <backgroundColor xsi:type="description:UserFixedColor" red="${hexR(style.color)}" green="${hexG(style.color)}" blue="${hexB(style.color)}"/>`);
    lines.push(`${ind}  <foregroundColor xsi:type="description:UserFixedColor" red="${hexR(style.color)}" green="${hexG(style.color)}" blue="${hexB(style.color)}"/>`);
    lines.push(`${ind}</style>`);
}
function emitEdgeStyle(lines, style, depth) {
    const ind = ' '.repeat(depth);
    const lineStyle = LINE_STYLE_MAP[style.lineStyle] || 'solid';
    const routing = ROUTING_MAP[style.routingStyle] || 'manhattan';
    const srcDeco = DECORATION_MAP[style.sourceDecoration] || 'NoDecoration';
    const tgtDeco = DECORATION_MAP[style.targetDecoration] || 'InputArrow';
    lines.push(`${ind}<style xsi:type="style:EdgeStyleDescription"`);
    lines.push(`${ind}    lineStyle="${lineStyle}"`);
    lines.push(`${ind}    sizeComputationExpression="${style.lineWidth}"`);
    lines.push(`${ind}    routingStyle="${routing}"`);
    lines.push(`${ind}    sourceArrow="${srcDeco}"`);
    lines.push(`${ind}    targetArrow="${tgtDeco}">`);
    lines.push(`${ind}  <strokeColor xsi:type="description:UserFixedColor" red="${hexR(style.color)}" green="${hexG(style.color)}" blue="${hexB(style.color)}"/>`);
    // Center label
    if (style.centerLabelExpression) {
        lines.push(`${ind}  <centerLabelStyleDescription labelSize="${style.labelSize}" labelExpression="${escapeXml(toAQL(style.centerLabelExpression))}">`);
        lines.push(`${ind}    <labelColor xsi:type="description:UserFixedColor" red="${hexR(style.labelColor)}" green="${hexG(style.labelColor)}" blue="${hexB(style.labelColor)}"/>`);
        lines.push(`${ind}  </centerLabelStyleDescription>`);
    }
    // Begin label
    if (style.beginLabelExpression) {
        lines.push(`${ind}  <beginLabelStyleDescription labelSize="${style.labelSize}" labelExpression="${escapeXml(toAQL(style.beginLabelExpression))}">`);
        lines.push(`${ind}    <labelColor xsi:type="description:UserFixedColor" red="${hexR(style.labelColor)}" green="${hexG(style.labelColor)}" blue="${hexB(style.labelColor)}"/>`);
        lines.push(`${ind}  </beginLabelStyleDescription>`);
    }
    // End label
    if (style.endLabelExpression) {
        lines.push(`${ind}  <endLabelStyleDescription labelSize="${style.labelSize}" labelExpression="${escapeXml(toAQL(style.endLabelExpression))}">`);
        lines.push(`${ind}    <labelColor xsi:type="description:UserFixedColor" red="${hexR(style.labelColor)}" green="${hexG(style.labelColor)}" blue="${hexB(style.labelColor)}"/>`);
        lines.push(`${ind}  </endLabelStyleDescription>`);
    }
    lines.push(`${ind}</style>`);
}
// ═══════════════════════════════════════════════════════════════
// Tools
// ═══════════════════════════════════════════════════════════════
function emitToolSection(lines, ts, options, depth) {
    const ind = ' '.repeat(depth);
    lines.push(`${ind}<toolSections name="${escapeXml(ts.label)}">`);
    for (const tool of ts.tools) {
        emitTool(lines, tool, options, depth + 2);
    }
    lines.push(`${ind}</toolSections>`);
}
function emitTool(lines, tool, options, depth) {
    const ind = ' '.repeat(depth);
    switch (tool.type) {
        case 'nodeCreation':
        case 'containerCreation': {
            const toolType = tool.type === 'nodeCreation' ? 'NodeCreationDescription' : 'ContainerCreationDescription';
            lines.push(`${ind}<ownedTools xsi:type="tool:${toolType}"`);
            lines.push(`${ind}    name="${escapeXml(tool.label)}">`);
            if (tool.createType) {
                lines.push(`${ind}  <initialOperation>`);
                lines.push(`${ind}    <firstModelOperations xsi:type="tool:CreateInstance"`);
                lines.push(`${ind}        typeName="${escapeXml(qualifyDomainClass(tool.createType, options.nsURI))}"`);
                lines.push(`${ind}        referenceName="${escapeXml(tool.containmentReference || 'eClassifiers')}"/>`);
                lines.push(`${ind}  </initialOperation>`);
            }
            lines.push(`${ind}</ownedTools>`);
            break;
        }
        case 'edgeCreation': {
            lines.push(`${ind}<ownedTools xsi:type="tool:EdgeCreationDescription"`);
            lines.push(`${ind}    name="${escapeXml(tool.label)}">`);
            if (tool.createType) {
                // Element-based edge
                lines.push(`${ind}  <initialOperation>`);
                lines.push(`${ind}    <firstModelOperations xsi:type="tool:CreateInstance"`);
                lines.push(`${ind}        typeName="${escapeXml(qualifyDomainClass(tool.createType, options.nsURI))}"`);
                lines.push(`${ind}        referenceName="${escapeXml(tool.containmentReference || '')}"/>`);
                lines.push(`${ind}  </initialOperation>`);
            }
            else {
                // Relation-based edge
                lines.push(`${ind}  <initialOperation>`);
                lines.push(`${ind}    <firstModelOperations xsi:type="tool:SetValue"`);
                lines.push(`${ind}        featureName="${escapeXml(tool.featureToSet || '')}"`);
                lines.push(`${ind}        valueExpression="var:target"/>`);
                lines.push(`${ind}  </initialOperation>`);
            }
            lines.push(`${ind}</ownedTools>`);
            break;
        }
        case 'delete': {
            lines.push(`${ind}<ownedTools xsi:type="tool:DeleteElementDescription"`);
            lines.push(`${ind}    name="${escapeXml(tool.label)}">`);
            lines.push(`${ind}  <initialOperation>`);
            lines.push(`${ind}    <firstModelOperations xsi:type="tool:RemoveElement"/>`);
            lines.push(`${ind}  </initialOperation>`);
            lines.push(`${ind}</ownedTools>`);
            break;
        }
        case 'directEdit': {
            lines.push(`${ind}<ownedTools xsi:type="tool:DirectEditLabel"`);
            lines.push(`${ind}    name="${escapeXml(tool.label)}">`);
            lines.push(`${ind}  <initialOperation>`);
            lines.push(`${ind}    <firstModelOperations xsi:type="tool:SetValue"`);
            lines.push(`${ind}        featureName="${escapeXml(tool.featureToSet || 'name')}"`);
            lines.push(`${ind}        valueExpression="var:arg0"/>`);
            lines.push(`${ind}  </initialOperation>`);
            lines.push(`${ind}</ownedTools>`);
            break;
        }
    }
}
// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
/**
 * Converts a webapp expression (e.g., "self.name") to AQL format.
 * If already prefixed with "aql:", returns as-is.
 */
function toAQL(expr) {
    if (!expr)
        return '';
    if (expr.startsWith('aql:'))
        return expr;
    if (expr.startsWith('feature:'))
        return expr;
    if (expr.startsWith('service:'))
        return expr;
    if (expr.startsWith('var:'))
        return expr;
    // Convert simple "self.xxx" to "aql:self.xxx"
    return `aql:${expr}`;
}
/**
 * Qualifies a domain class name with the nsURI for Sirius.
 * Sirius uses format: "nsURI::ClassName" or just "ClassName" for local.
 */
function qualifyDomainClass(className, nsURI) {
    if (!className)
        return '';
    if (className.includes('::'))
        return className; // Already qualified
    return `${nsURI}::${className}`;
}
/**
 * Gets the Sirius style type for a shape.
 */
function getStyleType(shape) {
    switch (shape) {
        case 'square': return 'SquareDescription';
        case 'dot': return 'DotDescription';
        case 'ellipse': return 'EllipseNodeDescription';
        case 'diamond': return 'LozengeNodeDescription';
        case 'note': return 'NoteDescription';
        case 'workspace': return 'WorkspaceImageDescription';
        default: return 'SquareDescription';
    }
}
/** Extract red component from hex color */
function hexR(hex) {
    return parseInt(hex.replace('#', '').substring(0, 2), 16) || 0;
}
/** Extract green component from hex color */
function hexG(hex) {
    return parseInt(hex.replace('#', '').substring(2, 4), 16) || 0;
}
/** Extract blue component from hex color */
function hexB(hex) {
    return parseInt(hex.replace('#', '').substring(4, 6), 16) || 0;
}
//# sourceMappingURL=SiriusOdesignGenerator.js.map