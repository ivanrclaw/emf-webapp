// ═══════════════════════════════════════════════════════════════
// Import (XMI → XmiInstanceDocument)
// ═══════════════════════════════════════════════════════════════
/**
 * Parses an XMI instance document and validates it against the provided metamodel.
 * @throws Error if the XML is invalid or doesn't conform to the metamodel
 */
export function importXmiInstance(xml, metamodel) {
    const cleaned = xml.replace(/<\?xml[^>]*\?>/, '').trim();
    // Extract namespace info from root element
    const rootTagMatch = cleaned.match(/^<([^\s>]+)/);
    if (!rootTagMatch) {
        throw new Error('Invalid XMI: no root element found');
    }
    const rootTag = rootTagMatch[1];
    const [prefix, className] = rootTag.includes(':')
        ? rootTag.split(':')
        : ['', rootTag];
    // Extract namespace declarations
    const nsURI = extractAttr(cleaned, `xmlns:${prefix}`) || metamodel.nsURI;
    const nsPrefix = prefix || metamodel.nsPrefix;
    // Build class lookup from metamodel
    const classMap = buildClassMap(metamodel);
    // Validate root class exists in metamodel
    const rootClass = classMap.get(className);
    if (!rootClass) {
        throw new Error(`Class "${className}" not found in metamodel "${metamodel.name}"`);
    }
    // Parse the root element
    const allInstances = [];
    const root = parseElement(cleaned, className, classMap, metamodel, allInstances);
    return {
        root,
        nsURI,
        nsPrefix,
        allInstances,
    };
}
/**
 * Parses a single XML element into an XmiInstance.
 */
function parseElement(xml, eClassName, classMap, metamodel, allInstances) {
    const eClass = classMap.get(eClassName);
    const instance = {
        eClass: eClassName,
        attributes: {},
        references: {},
        children: {},
    };
    allInstances.push(instance);
    if (!eClass) {
        // Unknown class — still parse attributes from XML but skip validation
        return instance;
    }
    // Parse attributes from XML attributes
    for (const attr of eClass.eAttributes) {
        const rawValue = extractAttr(xml, attr.name);
        if (rawValue !== '') {
            instance.attributes[attr.name] = convertAttributeValue(rawValue, attr.eType);
        }
    }
    // Also capture xmi:id if present
    const xmiId = extractAttr(xml, 'xmi:id');
    if (xmiId) {
        instance.attributes['xmi:id'] = xmiId;
    }
    // Parse references and containments
    for (const ref of eClass.eReferences) {
        if (ref.containment) {
            // Containment: parse child elements
            const childBlocks = extractChildBlocks(xml, ref.name);
            if (childBlocks.length > 0) {
                instance.children[ref.name] = [];
                for (const childBlock of childBlocks) {
                    // Determine child class from xsi:type or from reference target
                    const xsiType = extractAttr(childBlock, 'xsi:type');
                    let childClassName;
                    if (xsiType) {
                        // xsi:type="prefix:ClassName" → ClassName
                        childClassName = xsiType.includes(':')
                            ? xsiType.split(':')[1]
                            : xsiType;
                    }
                    else {
                        // Use the target class from the reference definition
                        childClassName = resolveTargetClassName(ref.targetId, classMap);
                    }
                    const child = parseElement(childBlock, childClassName, classMap, metamodel, allInstances);
                    instance.children[ref.name].push(child);
                }
            }
        }
        else {
            // Non-containment reference: look for child elements with href
            const refBlocks = extractChildBlocks(xml, ref.name);
            if (refBlocks.length > 0) {
                instance.references[ref.name] = [];
                for (const refBlock of refBlocks) {
                    const href = extractAttr(refBlock, 'href');
                    if (href) {
                        const refEntry = {
                            type: href.startsWith('#') ? 'internal' : 'external',
                            path: href,
                        };
                        instance.references[ref.name].push(refEntry);
                    }
                }
            }
            // Also check for inline reference attribute (space-separated fragment paths)
            const inlineRef = extractAttr(xml, ref.name);
            if (inlineRef && !instance.references[ref.name]) {
                instance.references[ref.name] = inlineRef.split(/\s+/).filter(Boolean).map((path) => ({
                    type: (path.startsWith('#') ? 'internal' : 'external'),
                    path,
                }));
            }
        }
    }
    return instance;
}
// ═══════════════════════════════════════════════════════════════
// Export (XmiInstanceDocument → XMI)
// ═══════════════════════════════════════════════════════════════
/**
 * Exports an XmiInstanceDocument to a valid XMI 2.0 string.
 */
export function exportXmiInstance(document, metamodel) {
    const { root, nsURI, nsPrefix } = document;
    const classMap = buildClassMap(metamodel);
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    // Build root element with namespace declarations
    const rootTag = `${nsPrefix}:${root.eClass}`;
    const rootAttrs = [
        `xmi:version="2.0"`,
        `xmlns:xmi="http://www.omg.org/XMI"`,
        `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
        `xmlns:${nsPrefix}="${escapeXml(nsURI)}"`,
    ];
    // Add attribute values for root
    const rootAttrStrings = buildAttributeStrings(root, classMap);
    rootAttrs.push(...rootAttrStrings);
    const hasChildren = hasContent(root);
    if (hasChildren) {
        lines.push(`<${rootTag} ${rootAttrs.join('\n    ')}>`);
        emitChildren(root, classMap, nsPrefix, lines, '  ');
        lines.push(`</${rootTag}>`);
    }
    else {
        lines.push(`<${rootTag} ${rootAttrs.join('\n    ')}/>`);
    }
    return lines.join('\n');
}
/**
 * Emits child elements (containments and references) for an instance.
 */
function emitChildren(instance, classMap, nsPrefix, lines, indent) {
    const eClass = classMap.get(instance.eClass);
    // Emit containment children
    for (const [refName, children] of Object.entries(instance.children)) {
        for (const child of children) {
            const childAttrs = [];
            // Add xsi:type if the child class differs from the reference target type
            if (eClass) {
                const ref = eClass.eReferences.find((r) => r.name === refName);
                if (ref) {
                    const targetClassName = resolveTargetClassName(ref.targetId, classMap);
                    if (targetClassName !== child.eClass) {
                        childAttrs.push(`xsi:type="${nsPrefix}:${child.eClass}"`);
                    }
                }
            }
            // Add attribute values
            childAttrs.push(...buildAttributeStrings(child, classMap));
            const childHasContent = hasContent(child);
            if (childHasContent) {
                if (childAttrs.length > 0) {
                    lines.push(`${indent}<${refName} ${childAttrs.join(' ')}>`);
                }
                else {
                    lines.push(`${indent}<${refName}>`);
                }
                emitChildren(child, classMap, nsPrefix, lines, indent + '  ');
                lines.push(`${indent}</${refName}>`);
            }
            else {
                if (childAttrs.length > 0) {
                    lines.push(`${indent}<${refName} ${childAttrs.join(' ')}/>`);
                }
                else {
                    lines.push(`${indent}<${refName}/>`);
                }
            }
        }
    }
    // Emit non-containment references as child elements with href
    for (const [refName, refs] of Object.entries(instance.references)) {
        for (const ref of refs) {
            lines.push(`${indent}<${refName} href="${escapeXml(ref.path)}"/>`);
        }
    }
}
/**
 * Builds attribute strings for an instance element.
 */
function buildAttributeStrings(instance, classMap) {
    const result = [];
    const eClass = classMap.get(instance.eClass);
    for (const [key, value] of Object.entries(instance.attributes)) {
        if (key === 'xmi:id') {
            result.push(`xmi:id="${escapeXml(String(value))}"`);
            continue;
        }
        // Validate attribute exists in metamodel (if class is known)
        if (eClass) {
            const attr = eClass.eAttributes.find((a) => a.name === key);
            if (!attr)
                continue; // skip unknown attributes
        }
        result.push(`${key}="${escapeXml(String(value))}"`);
    }
    return result;
}
/**
 * Checks if an instance has any child content (containments or references).
 */
function hasContent(instance) {
    for (const children of Object.values(instance.children)) {
        if (children.length > 0)
            return true;
    }
    for (const refs of Object.values(instance.references)) {
        if (refs.length > 0)
            return true;
    }
    return false;
}
// ═══════════════════════════════════════════════════════════════
// Fragment Path Utilities
// ═══════════════════════════════════════════════════════════════
/**
 * Generates a fragment path for an instance within a document.
 * Format: #//@featureName.index
 */
export function generateFragmentPath(document, target) {
    const path = findPath(document.root, target, '');
    return path ? `#${path}` : '';
}
/**
 * Recursively finds the path to a target instance.
 */
function findPath(current, target, prefix) {
    if (current === target)
        return prefix || '/';
    for (const [refName, children] of Object.entries(current.children)) {
        for (let i = 0; i < children.length; i++) {
            const childPath = `${prefix}//@${refName}.${i}`;
            const result = findPath(children[i], target, childPath);
            if (result !== null)
                return result;
        }
    }
    return null;
}
/**
 * Resolves a fragment path to an XmiInstance within a document.
 * Supports paths like: #//@books.0, #//@authors.1
 */
export function resolveFragmentPath(document, path) {
    // Remove leading # if present
    let fragment = path.startsWith('#') ? path.substring(1) : path;
    if (fragment === '/' || fragment === '') {
        return document.root;
    }
    // Parse segments: //@feature.index
    const segmentRegex = /\/@(\w+)\.(\d+)/g;
    let current = document.root;
    let match;
    while ((match = segmentRegex.exec(fragment)) !== null) {
        const featureName = match[1];
        const index = parseInt(match[2], 10);
        const children = current.children[featureName];
        if (!children || index >= children.length) {
            return null;
        }
        current = children[index];
    }
    return current === document.root ? null : current;
}
// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
/**
 * Builds a map of class name → SerializableEClass from the metamodel.
 */
function buildClassMap(metamodel) {
    const map = new Map();
    for (const classifier of metamodel.eClassifiers) {
        if ('eAttributes' in classifier) {
            map.set(classifier.name, classifier);
        }
    }
    return map;
}
/**
 * Resolves a targetId (which may be a class name or an ID) to a class name.
 */
function resolveTargetClassName(targetId, classMap) {
    // If targetId is already a class name in the map, return it
    if (classMap.has(targetId))
        return targetId;
    // Otherwise search by ID
    let found = targetId;
    classMap.forEach((cls, name) => {
        if (cls.id === targetId)
            found = name;
    });
    return found;
}
/**
 * Converts a raw string attribute value to the appropriate type
 * based on the EDataType name.
 */
function convertAttributeValue(raw, eType) {
    switch (eType) {
        case 'EInt':
        case 'EInteger':
        case 'ELong':
        case 'EShort':
        case 'EByte':
            return parseInt(raw, 10);
        case 'EFloat':
        case 'EDouble':
        case 'EBigDecimal':
            return parseFloat(raw);
        case 'EBoolean':
            return raw === 'true';
        case 'EString':
        case 'EDate':
        case 'EChar':
        default:
            return raw;
    }
}
/**
 * Escapes special XML characters in a string.
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
// ═══════════════════════════════════════════════════════════════
// XML Helpers (lightweight, no external deps)
// ═══════════════════════════════════════════════════════════════
/**
 * Extracts the value of an XML attribute.
 * Handles both single and double quotes.
 */
function extractAttr(xml, attrName) {
    // Escape special regex characters in attribute name (for namespaced attrs like xsi:type)
    const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*=\\s*"([^"]*?)"`, 'i');
    const singleRegex = new RegExp(`${escaped}\\s*=\\s*'([^']*?)'`, 'i');
    const m = regex.exec(xml) || singleRegex.exec(xml);
    return m ? m[1].trim() : '';
}
/**
 * Extracts child element blocks for a given tag name.
 * Only extracts direct children of the root element in the provided XML.
 */
function extractChildBlocks(xml, tagName) {
    const results = [];
    // Find the end of the root opening tag to only search within its body
    const bodyStart = findBodyStart(xml);
    if (bodyStart === -1)
        return results; // self-closing root
    const bodyEnd = xml.lastIndexOf('</');
    if (bodyEnd === -1)
        return results;
    const body = xml.substring(bodyStart, bodyEnd);
    // Find all occurrences of <tagName ...> or <tagName .../>
    const regex = new RegExp(`<${tagName}[\\s>/]`, 'g');
    let match;
    while ((match = regex.exec(body)) !== null) {
        const startIdx = match.index;
        // Find the full opening tag
        const tagEnd = body.indexOf('>', startIdx);
        if (tagEnd === -1)
            continue;
        const openTag = body.substring(startIdx, tagEnd + 1);
        // Self-closing tag
        if (openTag.endsWith('/>')) {
            results.push(openTag);
            continue;
        }
        // Find matching closing tag with depth tracking
        let depth = 1;
        let searchIdx = tagEnd + 1;
        const closeTag = `</${tagName}>`;
        while (depth > 0 && searchIdx < body.length) {
            const nextOpen = body.indexOf(`<${tagName}`, searchIdx);
            const nextClose = body.indexOf(closeTag, searchIdx);
            if (nextClose === -1)
                break;
            if (nextOpen !== -1 && nextOpen < nextClose) {
                // Check it's actually an opening tag (not <tagNameOther)
                const charAfter = body[nextOpen + tagName.length + 1];
                if (charAfter === ' ' || charAfter === '>' || charAfter === '/') {
                    depth++;
                }
                searchIdx = nextOpen + tagName.length + 1;
            }
            else {
                depth--;
                if (depth === 0) {
                    results.push(body.substring(startIdx, nextClose + closeTag.length));
                }
                searchIdx = nextClose + closeTag.length;
            }
        }
        // If we couldn't find closing tag, treat as self-contained
        if (depth > 0 && results.length === 0) {
            results.push(openTag);
        }
    }
    return results;
}
/**
 * Finds the index where the body of the root element starts (after the opening tag's '>').
 * Returns -1 if the root element is self-closing.
 */
function findBodyStart(xml) {
    let i = 0;
    // Skip past the opening '<tagName'
    while (i < xml.length && xml[i] !== '>') {
        if (xml[i] === '/' && i + 1 < xml.length && xml[i + 1] === '>') {
            return -1; // self-closing
        }
        // Skip quoted attribute values
        if (xml[i] === '"') {
            i++;
            while (i < xml.length && xml[i] !== '"')
                i++;
        }
        else if (xml[i] === "'") {
            i++;
            while (i < xml.length && xml[i] !== "'")
                i++;
        }
        i++;
    }
    return i < xml.length ? i + 1 : -1;
}
//# sourceMappingURL=XmiInstanceImporter.js.map