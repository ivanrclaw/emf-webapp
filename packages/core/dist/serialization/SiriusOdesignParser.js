/**
 * @emf-webapp/core — SiriusOdesignParser
 *
 * Parses Sirius .odesign XML files into a ViewpointSpec-compatible JSON structure.
 * Uses a lightweight built-in XML parser (no external dependencies).
 */
// ============================================================
// Lightweight XML Parser
// ============================================================
class SimpleXmlParser {
    xml;
    pos = 0;
    constructor(xml) {
        this.xml = xml;
    }
    parse() {
        this.skipWhitespace();
        // Skip XML declaration
        if (this.xml.substring(this.pos, this.pos + 2) === '<?') {
            this.skipUntil('?>');
            this.pos += 2;
        }
        this.skipWhitespace();
        return this.parseElement();
    }
    skipWhitespace() {
        while (this.pos < this.xml.length && /\s/.test(this.xml[this.pos])) {
            this.pos++;
        }
    }
    skipUntil(marker) {
        const idx = this.xml.indexOf(marker, this.pos);
        if (idx >= 0) {
            this.pos = idx;
        }
        else {
            this.pos = this.xml.length;
        }
    }
    peek() {
        return this.pos < this.xml.length ? this.xml[this.pos] : '';
    }
    peekN(n) {
        return this.xml.substring(this.pos, this.pos + n);
    }
    parseElement() {
        this.skipWhitespace();
        if (this.peek() !== '<') {
            throw new Error(`Expected '<' at position ${this.pos}, found '${this.peek()}'`);
        }
        this.pos++; // skip '<'
        // Skip comments
        if (this.peekN(3) === '!--') {
            this.pos += 3;
            this.skipUntil('-->');
            this.pos += 3;
            this.skipWhitespace();
            return this.parseElement();
        }
        const el = { name: '', attrs: {}, children: [], text: '' };
        el.name = this.parseName();
        // Parse attributes
        this.skipWhitespace();
        while (this.pos < this.xml.length && this.peek() !== '>' && this.peekN(2) !== '/>') {
            if (this.peek() === '/' || this.peek() === '>')
                break;
            const attrName = this.parseName();
            if (!attrName)
                break;
            this.skipWhitespace();
            if (this.peek() === '=') {
                this.pos++; // skip '='
                this.skipWhitespace();
                const attrValue = this.parseAttrValue();
                el.attrs[attrName] = attrValue;
            }
            this.skipWhitespace();
        }
        // Self-closing tag
        if (this.peekN(2) === '/>' || (this.peek() === '/' && this.xml[this.pos + 1] === '>')) {
            this.pos += 2;
            return el;
        }
        // Consume '>'
        if (this.peek() === '>') {
            this.pos++;
        }
        // Parse children and text content
        while (this.pos < this.xml.length) {
            this.skipWhitespace();
            if (this.peekN(2) === '</') {
                // Closing tag
                this.pos += 2;
                this.skipUntil('>');
                this.pos++; // skip '>'
                break;
            }
            if (this.peek() === '<') {
                // Check for comment
                if (this.xml.substring(this.pos, this.pos + 4) === '<!--') {
                    this.pos += 4;
                    this.skipUntil('-->');
                    this.pos += 3;
                    continue;
                }
                el.children.push(this.parseElement());
            }
            else {
                // Text content
                let text = '';
                while (this.pos < this.xml.length && this.peek() !== '<') {
                    text += this.xml[this.pos++];
                }
                el.text += this.decodeEntities(text.trim());
            }
        }
        return el;
    }
    parseName() {
        let name = '';
        while (this.pos < this.xml.length && /[a-zA-Z0-9_:.\-]/.test(this.xml[this.pos])) {
            name += this.xml[this.pos++];
        }
        return name;
    }
    parseAttrValue() {
        const quote = this.peek();
        if (quote !== '"' && quote !== "'") {
            throw new Error(`Expected quote at position ${this.pos}`);
        }
        this.pos++; // skip opening quote
        let value = '';
        while (this.pos < this.xml.length && this.xml[this.pos] !== quote) {
            if (this.xml[this.pos] === '&') {
                value += this.parseEntity();
            }
            else {
                value += this.xml[this.pos++];
            }
        }
        this.pos++; // skip closing quote
        return value;
    }
    parseEntity() {
        const start = this.pos;
        const end = this.xml.indexOf(';', start);
        if (end < 0) {
            this.pos++;
            return '&';
        }
        const entity = this.xml.substring(start, end + 1);
        this.pos = end + 1;
        switch (entity) {
            case '&amp;': return '&';
            case '&lt;': return '<';
            case '&gt;': return '>';
            case '&quot;': return '"';
            case '&apos;': return "'";
            default:
                if (entity.startsWith('&#x')) {
                    return String.fromCodePoint(parseInt(entity.substring(3, entity.length - 1), 16));
                }
                if (entity.startsWith('&#')) {
                    return String.fromCodePoint(parseInt(entity.substring(2, entity.length - 1), 10));
                }
                return entity;
        }
    }
    decodeEntities(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    }
}
// ============================================================
// Conversion Helpers
// ============================================================
/** Convert Sirius RGB integers (0-255) to hex color string */
function rgbToHex(r, g, b) {
    const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
/** Strip 'aql:' prefix from expressions */
function stripAqlPrefix(expr) {
    if (!expr)
        return '';
    if (expr.startsWith('aql:'))
        return expr.substring(4);
    return expr;
}
/** Extract class name from qualified domain class (nsURI::ClassName → ClassName) */
function extractClassName(qualifiedName) {
    if (!qualifiedName)
        return '';
    const idx = qualifiedName.lastIndexOf('::');
    if (idx >= 0)
        return qualifiedName.substring(idx + 2);
    return qualifiedName;
}
/** Convert Sirius decoration to webapp format */
function convertDecoration(decoration) {
    if (!decoration)
        return 'none';
    switch (decoration.toLowerCase()) {
        case 'nodecoration': return 'none';
        case 'inputarrow': return 'arrow';
        case 'outputarrow': return 'arrow';
        case 'diamond': return 'diamond';
        case 'inputfilledarrow': return 'filled-arrow';
        case 'outputfilledarrow': return 'filled-arrow';
        case 'inputclosedcircle': return 'closed-circle';
        case 'outputclosedcircle': return 'closed-circle';
        case 'inputfilleddiamond': return 'filled-diamond';
        case 'outputfilleddiamond': return 'filled-diamond';
        default: return decoration.toLowerCase();
    }
}
/** Convert Sirius line style to webapp format */
function convertLineStyle(style) {
    if (!style)
        return 'solid';
    switch (style.toLowerCase()) {
        case 'solid': return 'solid';
        case 'dash': return 'dash';
        case 'dot': return 'dot';
        case 'dash_dot': return 'dash-dot';
        default: return style.toLowerCase();
    }
}
/** Convert Sirius routing style to webapp format */
function convertRoutingStyle(routing) {
    if (!routing)
        return 'straight';
    switch (routing.toLowerCase()) {
        case 'straight': return 'straight';
        case 'manhattan': return 'manhattan';
        case 'tree': return 'tree';
        default: return routing.toLowerCase();
    }
}
/** Find a color element within a style element and convert to hex */
function extractColor(el, colorAttrName) {
    // Check for inline color attribute (e.g., color="//@userColorsPalettes.0/@entries.0")
    // or look for child color elements
    for (const child of el.children) {
        if (child.name === colorAttrName || child.name.endsWith(':' + colorAttrName)) {
            // UserFixedColor with red/green/blue
            const r = parseInt(child.attrs['red'] || '0', 10);
            const g = parseInt(child.attrs['green'] || '0', 10);
            const b = parseInt(child.attrs['blue'] || '0', 10);
            return rgbToHex(r, g, b);
        }
    }
    return '#000000';
}
/** Extract color from a style element, checking both child elements and attributes */
function resolveColor(el, attrName, defaultColor = '#000000') {
    // First check for child color element
    for (const child of el.children) {
        if (child.name === attrName) {
            if (child.attrs['xsi:type']?.includes('UserFixedColor') ||
                child.name === 'color' || child.attrs['red'] !== undefined) {
                const r = parseInt(child.attrs['red'] || '0', 10);
                const g = parseInt(child.attrs['green'] || '0', 10);
                const b = parseInt(child.attrs['blue'] || '0', 10);
                return rgbToHex(r, g, b);
            }
        }
    }
    // Check for inline color reference attribute
    if (el.attrs[attrName]) {
        // Could be a reference path - return default for now
        return defaultColor;
    }
    return defaultColor;
}
// ============================================================
// Parsing Logic
// ============================================================
function parseNodeStyle(styleEl) {
    const style = {
        shape: 'square',
        color: '#000000',
        borderColor: '#000000',
        borderSize: 1,
        borderLineStyle: 'solid',
        labelColor: '#000000',
        labelSize: 10,
        labelBold: false,
        labelItalic: false,
        labelPosition: 'center',
    };
    // Determine shape from element type
    const typeName = styleEl.name.split(':').pop() || styleEl.name;
    const xsiType = styleEl.attrs['xsi:type'] || '';
    const effectiveType = xsiType.split(':').pop() || typeName;
    switch (effectiveType) {
        case 'SquareDescription':
            style.shape = 'square';
            break;
        case 'DotDescription':
            style.shape = 'dot';
            break;
        case 'EllipseNodeDescription':
            style.shape = 'ellipse';
            break;
        case 'LozengeNodeDescription':
            style.shape = 'lozenge';
            break;
        case 'WorkspaceImageDescription':
            style.shape = 'image';
            break;
        case 'FlatContainerStyleDescription':
            style.shape = 'flat-container';
            break;
        case 'ShapeContainerStyleDescription':
            style.shape = 'shape-container';
            break;
        default:
            style.shape = 'square';
    }
    // Border
    if (styleEl.attrs['borderSizeComputationExpression']) {
        const expr = styleEl.attrs['borderSizeComputationExpression'];
        const num = parseInt(expr, 10);
        if (!isNaN(num))
            style.borderSize = num;
    }
    if (styleEl.attrs['borderLineStyle']) {
        style.borderLineStyle = convertLineStyle(styleEl.attrs['borderLineStyle']);
    }
    // Label
    if (styleEl.attrs['labelSize']) {
        style.labelSize = parseInt(styleEl.attrs['labelSize'], 10) || 10;
    }
    if (styleEl.attrs['labelFormat']) {
        const fmt = styleEl.attrs['labelFormat'].toLowerCase();
        style.labelBold = fmt.includes('bold');
        style.labelItalic = fmt.includes('italic');
    }
    if (styleEl.attrs['labelPosition']) {
        style.labelPosition = styleEl.attrs['labelPosition'].toLowerCase();
    }
    // Colors from child elements
    style.color = resolveColor(styleEl, 'color', '#cccccc');
    style.borderColor = resolveColor(styleEl, 'borderColor', '#000000');
    style.labelColor = resolveColor(styleEl, 'labelColor', '#000000');
    return style;
}
function parseEdgeStyle(styleEl) {
    const style = {
        lineStyle: 'solid',
        lineWidth: 1,
        color: '#000000',
        sourceDecoration: 'none',
        targetDecoration: 'none',
        routingStyle: 'straight',
        labelColor: '#000000',
        labelSize: 10,
    };
    if (styleEl.attrs['lineStyle']) {
        style.lineStyle = convertLineStyle(styleEl.attrs['lineStyle']);
    }
    if (styleEl.attrs['sizeComputationExpression']) {
        const num = parseInt(styleEl.attrs['sizeComputationExpression'], 10);
        if (!isNaN(num))
            style.lineWidth = num;
    }
    if (styleEl.attrs['sourceArrow']) {
        style.sourceDecoration = convertDecoration(styleEl.attrs['sourceArrow']);
    }
    if (styleEl.attrs['targetArrow']) {
        style.targetDecoration = convertDecoration(styleEl.attrs['targetArrow']);
    }
    if (styleEl.attrs['routingStyle']) {
        style.routingStyle = convertRoutingStyle(styleEl.attrs['routingStyle']);
    }
    // Color
    style.color = resolveColor(styleEl, 'strokeColor', '#000000');
    // Center label
    for (const child of styleEl.children) {
        if (child.name === 'centerLabelStyleDescription' || child.attrs['xsi:type']?.includes('CenterLabelStyleDescription')) {
            if (child.attrs['labelExpression']) {
                style.centerLabelExpression = stripAqlPrefix(child.attrs['labelExpression']);
            }
            if (child.attrs['labelSize']) {
                style.labelSize = parseInt(child.attrs['labelSize'], 10) || 10;
            }
            style.labelColor = resolveColor(child, 'labelColor', '#000000');
        }
    }
    return style;
}
function parseNodeMapping(el) {
    const id = el.attrs['name'] || '';
    const domainClass = extractClassName(el.attrs['domainClass']);
    const semanticCandidatesExpression = stripAqlPrefix(el.attrs['semanticCandidatesExpression']);
    let labelExpression = stripAqlPrefix(el.attrs['labelExpression'] || '');
    // Find style child
    let defaultStyle = {
        shape: 'square',
        color: '#cccccc',
        borderColor: '#000000',
        borderSize: 1,
        borderLineStyle: 'solid',
        labelColor: '#000000',
        labelSize: 10,
        labelBold: false,
        labelItalic: false,
        labelPosition: 'center',
    };
    for (const child of el.children) {
        const childType = child.name.split(':').pop() || child.name;
        if (childType === 'style' || childType.endsWith('Description') ||
            child.attrs['xsi:type']?.includes('Description')) {
            defaultStyle = parseNodeStyle(child);
            // Extract labelExpression from style if not on the mapping element
            if (!labelExpression && child.attrs['labelExpression']) {
                labelExpression = stripAqlPrefix(child.attrs['labelExpression']);
            }
            break;
        }
    }
    if (!labelExpression) {
        labelExpression = 'feature:name';
    }
    return {
        id,
        domainClass,
        semanticCandidatesExpression,
        labelExpression,
        defaultStyle,
    };
}
function parseContainerMapping(el) {
    const base = parseNodeMapping(el);
    const childrenPresentation = el.attrs['childrenPresentation'] || 'FreeForm';
    return {
        ...base,
        childrenPresentation,
    };
}
function parseEdgeMapping(el) {
    const id = el.attrs['name'] || '';
    const useDomainElement = el.attrs['useDomainElement'] === 'true';
    const type = useDomainElement ? 'element-based' : 'relation-based';
    const domainClass = useDomainElement ? extractClassName(el.attrs['domainClass']) : undefined;
    const sourceReference = el.attrs['sourceMapping'] || undefined;
    // Source and target mapping IDs (space-separated references)
    const sourceMappingIds = (el.attrs['sourceMapping'] || '').split(/\s+/).filter(Boolean);
    const targetMappingIds = (el.attrs['targetMapping'] || '').split(/\s+/).filter(Boolean);
    const targetFinderExpression = stripAqlPrefix(el.attrs['targetFinderExpression']);
    const sourceFinderExpression = el.attrs['sourceFinderExpression']
        ? stripAqlPrefix(el.attrs['sourceFinderExpression'])
        : undefined;
    // Find edge style child
    let defaultStyle = {
        lineStyle: 'solid',
        lineWidth: 1,
        color: '#000000',
        sourceDecoration: 'none',
        targetDecoration: 'none',
        routingStyle: 'straight',
        labelColor: '#000000',
        labelSize: 10,
    };
    for (const child of el.children) {
        const childType = child.name.split(':').pop() || child.name;
        if (childType === 'style' || childType.includes('EdgeStyleDescription') ||
            child.attrs['xsi:type']?.includes('EdgeStyleDescription')) {
            defaultStyle = parseEdgeStyle(child);
            break;
        }
    }
    return {
        id,
        type,
        domainClass,
        sourceReference: useDomainElement ? undefined : sourceReference,
        sourceMappingIds,
        targetMappingIds,
        targetFinderExpression,
        sourceFinderExpression,
        defaultStyle,
    };
}
function parseTool(el) {
    const typeName = el.attrs['xsi:type']?.split(':').pop() || el.name.split(':').pop() || el.name;
    const label = el.attrs['name'] || el.attrs['label'] || '';
    const tool = {
        type: typeName,
        label,
    };
    // Look for initialOperation > firstModelOperations > CreateInstance
    for (const child of el.children) {
        if (child.name === 'initialOperation') {
            for (const opChild of child.children) {
                if (opChild.name === 'firstModelOperations') {
                    const createType = opChild.attrs['typeName'];
                    if (createType) {
                        tool.createType = extractClassName(createType);
                    }
                    if (opChild.attrs['referenceName']) {
                        tool.containmentReference = opChild.attrs['referenceName'];
                    }
                    if (opChild.attrs['featureName']) {
                        tool.featureToSet = opChild.attrs['featureName'];
                    }
                    // Check sub-operations for SetValue
                    for (const subOp of opChild.children) {
                        if (subOp.attrs['featureName'] && !tool.featureToSet) {
                            tool.featureToSet = subOp.attrs['featureName'];
                        }
                    }
                }
            }
        }
    }
    return tool;
}
function parseToolSection(el) {
    const label = el.attrs['name'] || el.attrs['label'] || '';
    const tools = [];
    for (const child of el.children) {
        const childType = child.attrs['xsi:type']?.split(':').pop() || child.name.split(':').pop() || '';
        if (childType.includes('Creation') || childType.includes('Tool') ||
            childType.includes('Delete') || childType.includes('Reconnect') ||
            child.name === 'ownedTools') {
            if (child.name === 'ownedTools') {
                tools.push(parseTool(child));
            }
            else {
                tools.push(parseTool(child));
            }
        }
    }
    // If no tools found via type detection, try all children as tools
    if (tools.length === 0) {
        for (const child of el.children) {
            if (child.attrs['name'] || child.attrs['label']) {
                tools.push(parseTool(child));
            }
        }
    }
    return { label, tools };
}
function parseLayer(el) {
    const name = el.attrs['name'] || 'Default';
    const nodeMappings = [];
    const containerMappings = [];
    const edgeMappings = [];
    const toolSections = [];
    for (const child of el.children) {
        const childName = child.name.split(':').pop() || child.name;
        switch (childName) {
            case 'nodeMappings':
                nodeMappings.push(parseNodeMapping(child));
                break;
            case 'containerMappings':
                containerMappings.push(parseContainerMapping(child));
                break;
            case 'edgeMappings':
                edgeMappings.push(parseEdgeMapping(child));
                break;
            case 'toolSections':
                toolSections.push(parseToolSection(child));
                break;
        }
    }
    return { name, nodeMappings, containerMappings, edgeMappings, toolSections };
}
function parseDiagramDescription(el) {
    const label = el.attrs['name'] || '';
    const domainClass = extractClassName(el.attrs['domainClass']);
    const titleExpression = el.attrs['titleExpression']
        ? stripAqlPrefix(el.attrs['titleExpression'])
        : undefined;
    let defaultLayer = {
        name: 'Default',
        nodeMappings: [],
        containerMappings: [],
        edgeMappings: [],
        toolSections: [],
    };
    const additionalLayers = [];
    for (const child of el.children) {
        const childName = child.name.split(':').pop() || child.name;
        if (childName === 'defaultLayer') {
            defaultLayer = parseLayer(child);
        }
        else if (childName === 'additionalLayers') {
            additionalLayers.push(parseLayer(child));
        }
    }
    return {
        diagram: { label, domainClass, titleExpression },
        defaultLayer,
        additionalLayers,
    };
}
// ============================================================
// Main Export
// ============================================================
/**
 * Parses a Sirius .odesign XML string into a ViewpointSpec-compatible JSON structure.
 *
 * @param xml - The .odesign XML content as a string
 * @returns Parsed result with pluginId and viewpoints
 */
export function parseOdesign(xml) {
    const parser = new SimpleXmlParser(xml);
    const root = parser.parse();
    // The root element should be description:Group
    const pluginId = root.attrs['name'] || '';
    const viewpoints = [];
    // Find ownedViewpoints
    for (const child of root.children) {
        const childName = child.name.split(':').pop() || child.name;
        if (childName === 'ownedViewpoints') {
            const vpName = child.attrs['name'] || '';
            // Find DiagramDescription within the viewpoint
            for (const vpChild of child.children) {
                const vpChildName = vpChild.name.split(':').pop() || vpChild.name;
                if (vpChildName === 'ownedRepresentations' || vpChildName === 'ownedRepresentationExtensions') {
                    const xsiType = vpChild.attrs['xsi:type'] || '';
                    if (xsiType.includes('DiagramDescription') || vpChildName === 'ownedRepresentations') {
                        const { diagram, defaultLayer, additionalLayers } = parseDiagramDescription(vpChild);
                        viewpoints.push({
                            name: vpName,
                            diagram,
                            defaultLayer,
                            additionalLayers,
                        });
                    }
                }
            }
            // If no representations found yet, the viewpoint might have direct diagram children
            if (viewpoints.length === 0 || viewpoints[viewpoints.length - 1]?.name !== vpName) {
                // Check for direct DiagramDescription children (alternative structure)
                for (const vpChild of child.children) {
                    const xsiType = vpChild.attrs['xsi:type'] || '';
                    if (xsiType.includes('DiagramDescription')) {
                        const { diagram, defaultLayer, additionalLayers } = parseDiagramDescription(vpChild);
                        viewpoints.push({
                            name: vpName,
                            diagram,
                            defaultLayer,
                            additionalLayers,
                        });
                    }
                }
            }
        }
    }
    return { pluginId, viewpoints };
}
//# sourceMappingURL=SiriusOdesignParser.js.map